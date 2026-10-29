import { Router, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { rateLimit } from "../middleware/rateLimit.js";

export const publicRouter = Router();

function databaseFailure(res: Response, context: string, error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? (error as { code: unknown }).code
    : undefined;
  console.error(`[public/${context}] database request failed`, { code });
  return res.status(500).json({ error: "Something went wrong. Please try again." });
}

// The global API limiter is complemented by a stricter contact-form limit: 5 submissions per
// 10 minutes per IP is generous for real prospects and helps blunt scripted spam.
const leadsRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: "Too many submissions from this network — please try again in a few minutes, or email us directly.",
});

// --- Content reads (published only) ---

publicRouter.get("/services", async (_req, res) => {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true });
  if (error) return databaseFailure(res, "services", error);
  res.json(data);
});

publicRouter.get("/projects", async (_req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("published", true)
    .order("sort_order", { ascending: true });
  if (error) return databaseFailure(res, "projects", error);
  res.json(data);
});

publicRouter.get("/projects/:slug", async (req, res) => {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", req.params.slug)
    .eq("published", true)
    .single();
  if (error) return res.status(404).json({ error: "Project not found" });
  res.json(data);
});

publicRouter.get("/testimonials", async (_req, res) => {
  const { data, error } = await supabase
    .from("testimonials")
    .select("*")
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (error) return databaseFailure(res, "testimonials", error);
  res.json(data);
});

publicRouter.get("/faqs", async (req, res) => {
  let query = supabase.from("faqs").select("*").order("sort_order", { ascending: true });
  if (req.query.page) query = query.eq("page", String(req.query.page));
  const { data, error } = await query;
  if (error) return databaseFailure(res, "faqs", error);
  res.json(data);
});

publicRouter.get("/process-steps", async (_req, res) => {
  const { data, error } = await supabase
    .from("process_steps")
    .select("*")
    .order("phase_number", { ascending: true });
  if (error) return databaseFailure(res, "process-steps", error);
  res.json(data);
});

// --- Contact form → leads ---

const leadSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  work_email: z.string().trim().email().max(320),
  organization: z.string().trim().max(200).optional(),
  website: z.string().trim().max(500).optional(),
  domain_interest: z.array(z.string().max(100)).max(10).optional(),
  budget_range: z.string().max(100).optional(),
  timeline: z.string().max(100).optional(),
  message: z.string().trim().min(1).max(5000),
  nda_requested: z.boolean().optional(),
});

publicRouter.post("/leads", leadsRateLimit, async (req, res) => {
  const parsed = leadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid submission", details: parsed.error.flatten() });
  }
  const { error } = await supabase.from("leads").insert(parsed.data);
  if (error) return databaseFailure(res, "leads", error);
  res.status(201).json({ ok: true });
});
