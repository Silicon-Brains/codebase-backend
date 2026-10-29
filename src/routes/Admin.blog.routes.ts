import { Router } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";

/**
 * Mounted from admin.routes.ts, which is already behind requireAuth + requireRole('admin'):
 *
 *   import { blogAdminRouter } from './admin.blog.routes';
 *   router.use('/blog-posts', blogAdminRouter);
 */
export const blogAdminRouter = Router();

// Empty strings from forms become null (same convention as the other admin routes).
const nullableText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

const shape = {
  title: z.string().trim().min(1, "Title is required").max(160),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(120)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens",
    ),
  excerpt: nullableText(300),
  content: z.string().max(100_000).optional(),
  cover_image_url: nullableText(500),
  category: nullableText(60),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  author_name: nullableText(80),
  seo_description: nullableText(180),
  featured: z.boolean().optional(),
  published: z.boolean().optional(),
};

const createSchema = z.object(shape).strict();
const updateSchema = z.object(shape).partial().strict();
const idSchema = z.string().uuid();

function sendDbError(res: any, error: { code?: string; message: string }) {
  if (error.code === "23505") {
    return res
      .status(409)
      .json({
        error: "A post with this slug already exists",
        fields: { slug: ["Already in use"] },
      });
  }
  console.error("[admin/blog-posts]", error);
  return res.status(500).json({ error: "Something went wrong. Try again." });
}

function invalid(res: any, err: z.ZodError) {
  return res
    .status(400)
    .json({
      error: "Check the highlighted fields",
      fields: err.flatten().fieldErrors,
    });
}

blogAdminRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) return sendDbError(res, error);
  res.json(data);
});

blogAdminRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);

  const isPublished = parsed.data.published ?? false;
  const row = {
    ...parsed.data,
    // Keep legacy columns in sync for existing readers and records.
    author: parsed.data.author_name ?? null,
    body: parsed.data.content ?? '',
    status: isPublished ? 'published' : 'draft',
    published_at: isPublished ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from("blog_posts")
    .insert(row)
    .select("*")
    .single();
  if (error) return sendDbError(res, error);
  res.status(201).json(data);
});

blogAdminRouter.patch("/:id", async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success)
    return res.status(404).json({ error: "Post not found" });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return invalid(res, parsed.error);

  const { data: existing, error: findErr } = await supabase
    .from("blog_posts")
    .select("published_at")
    .eq("id", req.params.id)
    .maybeSingle();
  if (findErr) return sendDbError(res, findErr);
  if (!existing) return res.status(404).json({ error: "Post not found" });

  const patch: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.content !== undefined) patch.body = parsed.data.content;
  if (parsed.data.author_name !== undefined) patch.author = parsed.data.author_name;
  if (parsed.data.published !== undefined) {
    patch.status = parsed.data.published ? 'published' : 'draft';
  }
  // Stamp the first publish date once; unpublishing keeps it so re-publishing doesn't reorder history.
  if (parsed.data.published === true && !existing.published_at) {
    patch.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .update(patch)
    .eq("id", req.params.id)
    .select("*")
    .single();
  if (error) return sendDbError(res, error);
  res.json(data);
});

blogAdminRouter.delete("/:id", async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success)
    return res.status(404).json({ error: "Post not found" });
  const { error } = await supabase
    .from("blog_posts")
    .delete()
    .eq("id", req.params.id);
  if (error) return sendDbError(res, error);
  res.status(204).end();
});
