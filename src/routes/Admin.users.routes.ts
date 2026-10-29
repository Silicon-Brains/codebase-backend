import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';

/**
 * Mounted from admin.routes.ts (already behind requireAuth + requireRole('admin')):
 *
 *   import { usersAdminRouter } from './admin.users.routes';
 *   router.use('/users', usersAdminRouter);
 *
 * Roles are intentionally NOT editable here (architecture.md §4.2): admins are promoted
 * manually in Supabase so nobody can self-assign or escalate. Only profile details are.
 */
export const usersAdminRouter = Router();

const nullableText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

const updateSchema = z
  .object({
    full_name: nullableText(120),
    company_name: nullableText(120),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

const idSchema = z.string().uuid();

const COLUMNS = 'id, clerk_user_id, email, full_name, role, company_name, created_at';

usersAdminRouter.get('/', async (_req, res) => {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[admin/users]', error);
    return res.status(500).json({ error: 'Could not load users' });
  }

  const { data: projects, error: projErr } = await supabase
    .from('client_projects')
    .select('client_profile_id');
  if (projErr) {
    console.error('[admin/users]', projErr);
    return res.status(500).json({ error: 'Could not load users' });
  }

  const counts = new Map<string, number>();
  for (const p of projects ?? []) {
    counts.set(p.client_profile_id, (counts.get(p.client_profile_id) ?? 0) + 1);
  }

  res.json((profiles ?? []).map((p) => ({ ...p, engagement_count: counts.get(p.id) ?? 0 })));
});

usersAdminRouter.patch('/:id', async (req, res) => {
  if (!idSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'User not found' });

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Check the highlighted fields', fields: parsed.error.flatten().fieldErrors });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select(COLUMNS)
    .maybeSingle();

  if (error) {
    console.error('[admin/users]', error);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
  if (!data) return res.status(404).json({ error: 'User not found' });

  const { count } = await supabase
    .from('client_projects')
    .select('id', { count: 'exact', head: true })
    .eq('client_profile_id', data.id);

  res.json({ ...data, engagement_count: count ?? 0 });
});