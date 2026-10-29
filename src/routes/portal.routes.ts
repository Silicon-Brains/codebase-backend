import { Router, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { portalMessagesRouter } from './Portal.messages.routes.js';

export const portalRouter = Router();

portalRouter.use(requireAuth, requireRole("client"));
portalRouter.use('/messages', portalMessagesRouter);

const PROJECT_COLS = "id, title, current_phase, status_summary, progress_percent, created_at, updated_at";
const MILESTONE_COLS = "id, title, due_date, status, notes, amount, currency, paid_at, paid_via";
const INVOICE_COLS = "id, client_project_id, invoice_number, amount, currency, status, issued_date, due_date";

const SPRINT_COLS = "id, sprint_label, dates_label, deliverables_done, deliverables_total, velocity_label, velocity_sub, build_label, build_sub, code_delta_label, commits_label, milestone_paid_label, milestone_total_label, milestone_status, cve_label, vulnerabilities_label, governance_label, governance_sub";
const TASK_COLS = "id, title, description, engineering_status, icon, sort_order";
const REPO_COLS = "id, name, description, branch, version_label, build_label, sort_order";
const ARTIFACT_COLS = "id, label, sort_order";
const TEAM_COLS = "id, full_name, role, handle, status, sort_order";
const STAGING_COLS = "id, name, version_label, url, status, sort_order";

const uuid = z.string().uuid();

function dbError(res: Response, context: string, error: unknown) {
  console.error(`portal ${context} error:`, error);
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

portalRouter.get("/projects", async (req: AuthedRequest, res: Response) => {
  const { data, error } = await supabase
    .from("client_projects")
    .select(PROJECT_COLS)
    .eq("client_profile_id", req.profile!.id)
    .order("created_at", { ascending: false });
  if (error) return dbError(res, "projects", error);
  res.json(data);
});

portalRouter.get("/projects/:id", async (req: AuthedRequest, res: Response) => {
  if (!uuid.safeParse(req.params.id).success) return res.status(404).json({ error: "Project not found" });

  const { data: project, error } = await supabase
    .from("client_projects")
    .select(PROJECT_COLS)
    .eq("id", req.params.id)
    .eq("client_profile_id", req.profile!.id)
    .maybeSingle();
  if (error) return dbError(res, "project", error);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [milestones, invoices] = await Promise.all([
    supabase.from("milestones").select(MILESTONE_COLS).eq("client_project_id", project.id).order("due_date", { ascending: true }),
    supabase.from("invoices").select(INVOICE_COLS).eq("client_project_id", project.id).order("issued_date", { ascending: false }),
  ]);
  if (milestones.error) return dbError(res, "milestones", milestones.error);
  if (invoices.error) return dbError(res, "project invoices", invoices.error);

  res.json({ ...project, milestones: milestones.data ?? [], invoices: invoices.data ?? [] });
});

portalRouter.get("/invoices", async (req: AuthedRequest, res: Response) => {
  const { data: projects, error: projErr } = await supabase
    .from("client_projects")
    .select("id, title")
    .eq("client_profile_id", req.profile!.id);
  if (projErr) return dbError(res, "invoice projects", projErr);

  const titles = new Map((projects ?? []).map((p) => [p.id as string, p.title as string]));
  if (titles.size === 0) return res.json([]);

  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLS)
    .in("client_project_id", [...titles.keys()])
    .order("issued_date", { ascending: false });
  if (error) return dbError(res, "invoices", error);

  res.json((data ?? []).map((inv) => ({ ...inv, project_title: titles.get(inv.client_project_id as string) ?? null })));
});

// Sprint view — everything the redesigned portal dashboard needs.
portalRouter.get("/projects/:id/sprint", async (req: AuthedRequest, res: Response) => {
  if (!uuid.safeParse(req.params.id).success) return res.status(404).json({ error: "Project not found" });

  const { data: project, error } = await supabase
    .from("client_projects")
    .select("id, title, current_phase, status_summary, progress_percent, created_at, updated_at")
    .eq("id", req.params.id)
    .eq("client_profile_id", req.profile!.id)
    .maybeSingle();
  if (error) return dbError(res, "sprint project", error);
  if (!project) return res.status(404).json({ error: "Project not found" });

  const [sprint, tasks, repos, artifacts, team, staging] = await Promise.all([
    supabase.from("sprint_cycles").select(SPRINT_COLS).eq("client_project_id", project.id).order("sort_order", { ascending: true }).limit(1),
    supabase.from("project_tasks").select(TASK_COLS).eq("client_project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("code_repositories").select(REPO_COLS).eq("client_project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("repo_artifacts").select(ARTIFACT_COLS).eq("client_project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("project_team_members").select(TEAM_COLS).eq("client_project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("staging_deployments").select(STAGING_COLS).eq("client_project_id", project.id).order("sort_order", { ascending: true }),
  ]);

  const fallback = <T,>(r: { data: T[] | null; error: unknown }, list: T[] = []): T[] => (r.error ? list : r.data ?? list);

  res.json({
    project,
    sprint: fallback(sprint)[0] ?? null,
    tasks: fallback(tasks),
    repositories: fallback(repos),
    artifacts: fallback(artifacts),
    team: fallback(team),
    staging: fallback(staging),
  });
});