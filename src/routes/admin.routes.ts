import { Router, type Request, type Response } from "express";
import { z, type ZodObject, type ZodRawShape, type ZodIssue } from "zod";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { blogAdminRouter } from './Admin.blog.routes.js';
import { usersAdminRouter } from './Admin.users.routes.js';
import { settingsAdminRouter } from './Admin.settings.routes.js';
import { messagesAdminRouter } from './Admin.messages.routes.js';
import { analyticsAdminRouter } from './Admin.analytics.routes.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("admin"));

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const req = (max = 500) => z.string().trim().min(1).max(max);
const opt = (max = 500) =>
  z.string().trim().max(max).nullish().transform((v) => (v === "" ? null : v));
const list = z.array(z.string().trim().min(1).max(300)).max(50);
const uuid = z.string().uuid();
const slug = z
  .string()
  .trim()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers and hyphens only");
const date = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD"), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === undefined ? undefined : v || null));

const schemas = {
  services: z
    .object({
      title: req(200),
      slug,
      icon: opt(100),
      category: opt(100),
      tag: opt(100),
      description: opt(2000),
      features: list.optional(),
      deliverables: list.optional(),
      architecture_baseline: list.optional(),
      metric_label: opt(100),
      metric_value: opt(100),
      sort_order: z.number().int().optional(),
      published: z.boolean().optional(),
    })
    .strict(),
  projects: z
    .object({
      title: req(200),
      slug,
      summary: opt(2000),
      category: opt(100),
      tag: opt(100),
      highlights: list.optional(),
      tech_stack: list.optional(),
      metrics: z
        .array(z.object({ value: req(50), label: req(100) }).strict())
        .max(6)
        .optional(),
      cover_image_url: z
        .union([z.string().trim().url().max(1000), z.literal(""), z.null()])
        .optional()
        .transform((v) => (v === undefined ? undefined : v || null)),
      featured: z.boolean().optional(),
      sort_order: z.number().int().optional(),
      published: z.boolean().optional(),
    })
    .strict(),
  testimonials: z
    .object({
      author_name: req(200),
      author_role: opt(200),
      company: opt(200),
      quote: req(2000),
      published: z.boolean().optional(),
    })
    .strict(),
  faqs: z
    .object({
      question: req(500),
      answer: req(3000),
      page: opt(50),
      sort_order: z.number().int().optional(),
    })
    .strict(),
  process_steps: z
    .object({
      phase_number: z.number().int().min(1).max(20),
      title: req(200),
      subtitle: opt(100),
      description: opt(2000),
      core_focus: list.optional(),
      key_deliverables: list.optional(),
      artifact_label: opt(100),
      artifact_note: opt(100),
      quality_gate: opt(200),
    })
    .strict(),
  client_projects: z
    .object({
      client_profile_id: uuid,
      title: req(200),
      current_phase: z.number().int().min(1).max(5).optional(),
      status_summary: opt(1000),
      progress_percent: z.number().int().min(0).max(100).optional(),
      status: z
        .enum(["ongoing", "completed", "planning", "on_hold", "cancelled"])
        .optional(),
    })
    .strict(),
  milestones: z
    .object({
      client_project_id: uuid,
      title: req(200),
      due_date: date,
      status: z.enum(["pending", "in_progress", "done"]).optional(),
      notes: opt(2000),
    })
    .strict(),
  invoices: z
    .object({
      invoice_number: z.string().trim().max(50).optional(),
      amount: z.number().nonnegative().max(1e9),
      currency: z.string().trim().length(3).toUpperCase().optional(),
      status: z.enum(["pending", "paid", "overdue"]).optional(),
      issued_date: date,
      due_date: date,
      line_items: z.array(z.object({
        description: req(500),
        qty: z.number().positive().max(1e6),
        rate: z.number().nonnegative().max(1e9),
      }).strict()).max(60).optional(),
      po_ref: opt(100),
      discount_percent: z.number().min(0).max(100).optional(),
      other_charges: z.number().nonnegative().max(1e9).optional(),
      payment_status: z.enum(["unpaid", "partial", "paid"]).optional(),
      billed_to_name: opt(200),
      billed_to_company: opt(200),
      billed_to_email: z.union([z.string().trim().email().max(200), z.literal(""), z.null()]).optional(),
      billed_to_phone: opt(60),
      billed_to_address: opt(1000),
      bank_account_name: opt(200),
      bank_branch: opt(200),
      bank_account_no: opt(100),
      bank_ifsc_swift: opt(100),
      upi_id: opt(200),
      cheque_in_favour: opt(200),
      payment_link: z.union([z.string().trim().url().max(1000), z.literal(""), z.null()]).optional(),
      late_fee_percent: z.number().min(0).max(100).nullable().optional(),
    })
    .strict(),
};

const LEAD_STATUSES = ["new", "contacted", "converted", "archived"] as const;

function issuesToMessage(issues: ZodIssue[]): string {
  return (
    "Validation failed — " +
    issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ")
  );
}

function sendDbError(res: Response, error: { code?: string; message: string }) {
  switch (error.code) {
    case "23505":
      return res
        .status(409)
        .json({ error: "A record with the same unique value already exists (slug, phase number or FAQ order)." });
    case "23503":
      return res
        .status(409)
        .json({ error: "Referenced record does not exist, or this record is still referenced elsewhere." });
    case "23514":
    case "22P02":
    case "22007":
      return res.status(400).json({ error: `Invalid value: ${error.message}` });
    case "PGRST116":
      return res.status(404).json({ error: "Record not found" });
    default:
      console.error("admin db error:", error);
      return res.status(500).json({ error: "Database error" });
  }
}

const TABLES_WITH_UPDATED_AT = new Set(["services", "projects", "client_projects"]);

interface CrudOptions<S extends ZodRawShape> {
  table: string;
  schema: ZodObject<S>;
  select?: string;
  order: { column: string; ascending: boolean };
  beforeWrite?: (body: Record<string, unknown>) => Promise<string | null>;
}

function crud<S extends ZodRawShape>({
  table,
  schema,
  select = "*",
  order,
  beforeWrite,
}: CrudOptions<S>) {
  const r = Router();
  const patchSchema = schema.partial();

  r.get("/", async (_req: Request, res: Response) => {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .order(order.column, { ascending: order.ascending });
    if (error) return sendDbError(res, error);
    res.json(data);
  });

  r.post("/", async (req: Request, res: Response) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: issuesToMessage(parsed.error.issues) });
    const problem = await beforeWrite?.(parsed.data as Record<string, unknown>);
    if (problem) return res.status(400).json({ error: problem });
    const { data, error } = await supabase
      .from(table)
      .insert(parsed.data as Record<string, unknown>)
      .select()
      .single();
    if (error) return sendDbError(res, error);
    res.status(201).json(data);
  });

  r.patch("/:id", async (req: Request, res: Response) => {
    if (!uuid.safeParse(req.params.id).success)
      return res.status(404).json({ error: "Record not found" });
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: issuesToMessage(parsed.error.issues) });
    if (Object.keys(parsed.data).length === 0)
      return res.status(400).json({ error: "Nothing to update" });
    const problem = await beforeWrite?.(parsed.data as Record<string, unknown>);
    if (problem) return res.status(400).json({ error: problem });
    const { data, error } = await supabase
      .from(table)
      .update({
        ...parsed.data,
        ...(TABLES_WITH_UPDATED_AT.has(table) ? { updated_at: new Date().toISOString() } : {}),
      })
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) return sendDbError(res, error);
    res.json(data);
  });

  r.delete("/:id", async (req: Request, res: Response) => {
    if (!uuid.safeParse(req.params.id).success)
      return res.status(404).json({ error: "Record not found" });
    const { error } = await supabase.from(table).delete().eq("id", req.params.id);
    if (error) return sendDbError(res, error);
    res.status(204).send();
  });

  return r;
}

// ---------------------------------------------------------------------------
// CMS — Services, Projects, Testimonials, FAQs, Process steps
// ---------------------------------------------------------------------------

adminRouter.use(
  "/services",
  crud({
    table: "services",
    schema: schemas.services,
    order: { column: "sort_order", ascending: true },
  })
);
adminRouter.use(
  "/projects",
  crud({
    table: "projects",
    schema: schemas.projects,
    order: { column: "sort_order", ascending: true },
  })
);
adminRouter.use(
  "/testimonials",
  crud({
    table: "testimonials",
    schema: schemas.testimonials,
    order: { column: "created_at", ascending: false },
  })
);
adminRouter.use(
  "/faqs",
  crud({ table: "faqs", schema: schemas.faqs, order: { column: "sort_order", ascending: true } })
);
adminRouter.use(
  "/process-steps",
  crud({
    table: "process_steps",
    schema: schemas.process_steps,
    order: { column: "phase_number", ascending: true },
  })
);
adminRouter.use('/blog-posts', blogAdminRouter);
adminRouter.use('/users', usersAdminRouter);
adminRouter.use('/settings', settingsAdminRouter);
adminRouter.use('/messages', messagesAdminRouter);
adminRouter.use('/analytics', analyticsAdminRouter);

// ---------------------------------------------------------------------------
// Leads — read + status updates; approval provisions a linked client profile.
// ---------------------------------------------------------------------------

adminRouter.get("/leads", async (_req, res) => {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return sendDbError(res, error);
  res.json(data);
});

adminRouter.patch("/leads/:id", async (req, res) => {
  if (!uuid.safeParse(req.params.id).success)
    return res.status(404).json({ error: "Record not found" });
  const parsed = z.object({ status: z.enum(LEAD_STATUSES) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: issuesToMessage(parsed.error.issues) });

  if (parsed.data.status === "converted") {
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, full_name, work_email, organization")
      .eq("id", req.params.id)
      .single();
    if (leadError) return sendDbError(res, leadError);

    const email = lead.work_email.trim().toLowerCase();
    const { data: existingProfile, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id, role, source_lead_id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (profileLookupError) return sendDbError(res, profileLookupError);
    if (existingProfile?.role === "admin") {
      return res.status(409).json({ error: "This enquiry uses an admin email and cannot be approved as a client." });
    }

    let clientProfileId: string;
    if (existingProfile) {
      clientProfileId = existingProfile.id;
      const updates: Record<string, unknown> = {};
      if (!existingProfile.source_lead_id) updates.source_lead_id = lead.id;
      if (Object.keys(updates).length > 0) {
        const { error: profileUpdateError } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", existingProfile.id);
        if (profileUpdateError) return sendDbError(res, profileUpdateError);
      }
    } else {
      const { data: createdProfile, error: profileCreateError } = await supabase
        .from("profiles")
        .upsert({
          source_lead_id: lead.id,
          clerk_user_id: null,
          email,
          full_name: lead.full_name,
          company_name: lead.organization,
          role: "client",
        }, { onConflict: "source_lead_id" })
        .select("id")
        .single();
      if (profileCreateError) return sendDbError(res, profileCreateError);
      clientProfileId = createdProfile.id;
    }

    // Approval starts a planning engagement. The title is deterministic so a
    // retry after a partial failure won't create a second engagement.
    const engagementTitle = `New engagement — ${lead.organization?.trim() || lead.full_name.trim()}`.slice(0, 200);
    const { data: existingEngagement, error: engagementLookupError } = await supabase
      .from("client_projects")
      .select("id")
      .eq("client_profile_id", clientProfileId)
      .eq("title", engagementTitle)
      .maybeSingle();
    if (engagementLookupError) return sendDbError(res, engagementLookupError);
    if (!existingEngagement) {
      const { error: engagementCreateError } = await supabase
        .from("client_projects")
        .insert({
          client_profile_id: clientProfileId,
          title: engagementTitle,
          current_phase: 1,
          progress_percent: 0,
          status: "planning",
        });
      if (engagementCreateError) return sendDbError(res, engagementCreateError);
    }
  }

  const { data, error } = await supabase
    .from("leads")
    .update(parsed.data)
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return sendDbError(res, error);
  res.json(data);
});

adminRouter.delete("/leads/:id", async (req, res) => {
  if (!uuid.safeParse(req.params.id).success)
    return res.status(404).json({ error: "Record not found" });
  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();
  if (error) return sendDbError(res, error);
  if (!data) return res.status(404).json({ error: "Enquiry not found" });
  res.status(204).send();
});

// ---------------------------------------------------------------------------
// Clients & their engagements
// ---------------------------------------------------------------------------

adminRouter.get("/clients", async (_req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, company_name, created_at, client_projects(id, title, current_phase, progress_percent)"
    )
    .eq("role", "client")
    .order("created_at", { ascending: false });
  if (error) return sendDbError(res, error);
  res.json(data);
});

async function requireClientProfile(body: Record<string, unknown>): Promise<string | null> {
  const id = body.client_profile_id;
  if (id === undefined) return null; // PATCH that doesn't touch the link
  const { data } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", id as string)
    .maybeSingle();
  if (!data) return "client_profile_id: no such profile";
  if (data.role !== "client") return "client_profile_id: profile is not a client";
  return null;
}

adminRouter.use(
  "/client-projects",
  crud({
    table: "client_projects",
    schema: schemas.client_projects,
    select: "*, client:profiles(full_name, email, company_name)",
    order: { column: "created_at", ascending: false },
    beforeWrite: requireClientProfile,
  })
);
adminRouter.use(
  "/milestones",
  crud({
    table: "milestones",
    schema: schemas.milestones,
    order: { column: "created_at", ascending: false },
  })
);
adminRouter.use(
  "/invoices",
  crud({
    table: "invoices",
    schema: schemas.invoices,
    order: { column: "created_at", ascending: false },
    beforeWrite: async (body) => {
      const items = body.line_items;
      if (!Array.isArray(items) || items.length === 0 || body.amount === undefined) return null;
      const subtotalCents = items.reduce((sum, item) => {
        const line = item as { qty: number; rate: number };
        return sum + Math.round(line.qty * line.rate * 100);
      }, 0);
      const discountCents = Math.round(subtotalCents * Number(body.discount_percent ?? 0) / 100);
      const chargesCents = Math.round(Number(body.other_charges ?? 0) * 100);
      const totalCents = subtotalCents - discountCents + chargesCents;
      if (Math.round(Number(body.amount) * 100) !== totalCents) {
        return "Invoice amount must match the line items, discount, and other charges.";
      }
      return null;
    },
  })
);

// ---------------------------------------------------------------------------
// Overview counts
// ---------------------------------------------------------------------------

async function count(table: string, filter?: (q: any) => any): Promise<number> {
  let q: any = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: n, error } = await q;
  if (error) throw new Error(error.message);
  return n ?? 0;
}

adminRouter.get("/overview", async (_req, res) => {
  try {
    const [newLeads, totalLeads, clients, activeEngagements, unpaidInvoices, services, projects] =
      await Promise.all([
        count("leads", (q) => q.eq("status", "new")),
        count("leads"),
        count("profiles", (q) => q.eq("role", "client")),
        count("client_projects", (q) => q.lt("progress_percent", 100)),
        count("invoices", (q) => q.in("status", ["pending", "overdue"])),
        count("services"),
        count("projects"),
      ]);
    res.json({
      newLeads,
      totalLeads,
      clients,
      activeEngagements,
      unpaidInvoices,
      services,
      projects,
    });
  } catch (err) {
    console.error("overview error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------------------------------------------------------------------------
// Command Center — one round-trip for the ops dashboard.
// Tables come from migration 004. Any missing table falls back to an empty array
// so a partial migration doesn't brick the whole page.
// ---------------------------------------------------------------------------

adminRouter.get("/command-center", async (_req, res) => {
  try {
    const [kpis, clusters, pipelines, squads, security, recentLeads, recentClients] =
      await Promise.all([
        supabase.from("ops_kpis").select("*").order("sort_order", { ascending: true }),
        supabase.from("ops_clusters").select("*").order("sort_order", { ascending: true }),
        supabase
          .from("ops_pipeline_runs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("ops_squads").select("*").order("sort_order", { ascending: true }),
        supabase.from("ops_security_items").select("*").order("sort_order", { ascending: true }),
        supabase
          .from("leads")
          .select(
            "id, full_name, organization, work_email, domain_interest, budget_range, timeline, message, nda_requested, status, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("profiles")
          .select(
            "id, email, full_name, company_name, created_at, client_projects(id, title, current_phase, progress_percent, status_summary)"
          )
          .eq("role", "client")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

    const fallback = <T,>(r: { data: T[] | null; error: unknown }, list: T[] = []): T[] =>
      r.error ? list : r.data ?? list;

    res.json({
      kpis: fallback(kpis),
      clusters: fallback(clusters),
      pipelines: fallback(pipelines),
      squads: fallback(squads),
      security: fallback(security),
      recentLeads: fallback(recentLeads),
      recentClients: fallback(recentClients),
    });
  } catch (err) {
    console.error("command-center error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------------------------------------------------------------------------
// Dashboard — everything the redesigned /admin page (mockup #1) needs in one
// round-trip. Tables come from migration 006 (message_threads, quick_tasks) +
// the `status` column added to client_projects. Missing tables degrade to 0/[].
// ---------------------------------------------------------------------------

const PROJECT_LIFECYCLE = ["ongoing", "completed", "planning", "on_hold", "cancelled"] as const;

adminRouter.get("/dashboard", async (_req, res) => {
  try {
    const now = new Date();
    const nineMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 8, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      allLeadsRes,
      activeProjectsCount,
      clientsCount,
      unreadMessagesCount,
      clientProjectsRes,
      recentEnquiriesRes,
      recentProjectsRes,
      recentThreadsRes,
      upcomingTasksRes,
      leads30d,
      projects30d,
      clients30d,
      messages30d,
    ] = await Promise.all([
      supabase
        .from("leads")
        .select("id, created_at, status")
        .gte("created_at", nineMonthsAgo.toISOString()),
      count("client_projects", (q) => q.in("status", ["ongoing", "planning"])),
      count("profiles", (q) => q.eq("role", "client")),
      count("message_threads", (q) => q.eq("unread", true)),
      supabase.from("client_projects").select("id, status"),
      supabase
        .from("leads")
        .select(
          "id, full_name, work_email, domain_interest, budget_range, status, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("client_projects")
        .select("id, title, status, updated_at, client:profiles(company_name, full_name)")
        .order("updated_at", { ascending: false })
        .limit(5),
      supabase
        .from("message_threads")
        .select("id, from_name, subject, unread, last_message_at")
        .order("last_message_at", { ascending: false })
        .limit(5),
      supabase
        .from("quick_tasks")
        .select("id, title, due_date, done, project:client_projects(title)")
        .eq("done", false)
        .order("due_date", { ascending: true })
        .limit(5),
      count("leads", (q) => q.gte("created_at", thirtyDaysAgo.toISOString())),
      count("client_projects", (q) =>
        q.in("status", ["ongoing", "planning"]).gte("created_at", thirtyDaysAgo.toISOString())
      ),
      count("profiles", (q) =>
        q.eq("role", "client").gte("created_at", thirtyDaysAgo.toISOString())
      ),
      count("message_threads", (q) => q.gte("created_at", thirtyDaysAgo.toISOString())),
    ]);

    // ---- Nine-month enquiry trend (group in JS — volume is low) ----
    const monthKeys: string[] = [];
    for (let i = 8; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const trendMap = new Map(monthKeys.map((k) => [k, { enquiries: 0, converted: 0 }]));
    for (const l of allLeadsRes.data ?? []) {
      const k = String(l.created_at).slice(0, 7);
      const bucket = trendMap.get(k);
      if (!bucket) continue;
      bucket.enquiries += 1;
      if (l.status === "converted") bucket.converted += 1;
    }
    const monthName = (key: string) => {
      const [y, m] = key.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
    };
    const enquiryTrend = monthKeys.map((k) => ({ month: monthName(k), ...trendMap.get(k)! }));

    // ---- Project status breakdown for the donut ----
    const statusCounts = new Map<string, number>();
    for (const p of clientProjectsRes.data ?? []) {
      const s = ((p as any).status as string) ?? "ongoing";
      statusCounts.set(s, (statusCounts.get(s) ?? 0) + 1);
    }
    const projectStatus = PROJECT_LIFECYCLE.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    }));

    // ---- KPI deltas ----
    const totalLeads = allLeadsRes.data?.length
      ? await count("leads")
      : 0; // fall back if the trend query returned nothing (fresh install)
    const totalClients = clientsCount;
    const activeProjects = activeProjectsCount;
    const unread = unreadMessagesCount;

    const delta = (curr: number, prev: number) => {
      if (prev === 0) return curr === 0 ? 0 : 100;
      return Math.round(((curr - prev) / prev) * 100);
    };

    res.json({
      kpis: {
        totalEnquiries: {
          value: totalLeads,
          delta: delta(totalLeads, Math.max(totalLeads - leads30d, 0)),
          trend: leads30d > 0 ? "up" : "flat",
        },
        activeProjects: {
          value: activeProjects,
          delta: delta(activeProjects, Math.max(activeProjects - projects30d, 0)),
          trend: projects30d > 0 ? "up" : "flat",
        },
        totalClients: {
          value: totalClients,
          delta: delta(totalClients, Math.max(totalClients - clients30d, 0)),
          trend: clients30d > 0 ? "up" : "flat",
        },
        unreadMessages: {
          value: unread,
          delta: messages30d,
          trend: messages30d > 0 ? "up" : "flat",
        },
      },
      enquiryTrend,
      projectStatus,
      recentEnquiries: (recentEnquiriesRes.data ?? []).map((l) => ({
        id: l.id,
        full_name: l.full_name,
        work_email: l.work_email,
        project_type:
          Array.isArray(l.domain_interest) && l.domain_interest.length > 0
            ? l.domain_interest[0]
            : null,
        budget_range: l.budget_range,
        status: l.status,
        created_at: l.created_at,
      })),
      recentProjects: (recentProjectsRes.data ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        category: p.client?.company_name ?? p.client?.full_name ?? null,
        status: p.status ?? "ongoing",
        updated_at: p.updated_at,
      })),
      recentMessages: (recentThreadsRes.data ?? []).map((m) => ({
        id: m.id,
        from_name: m.from_name,
        preview: m.subject ?? "",
        unread: m.unread,
        last_message_at: m.last_message_at,
      })),
      upcomingTasks: (upcomingTasksRes.data ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        due_date: t.due_date,
        project_title: t.project?.title ?? null,
      })),
    });
  } catch (err) {
    console.error("dashboard error:", err);
    res.status(500).json({ error: "Database error" });
  }
});
