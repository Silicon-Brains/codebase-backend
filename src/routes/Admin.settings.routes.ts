import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';

/**
 * Mounted from admin.routes.ts (already behind requireAuth + requireRole('admin')):
 *
 *   import { settingsAdminRouter } from './admin.settings.routes';
 *   router.use('/settings', settingsAdminRouter);
 */
export const settingsAdminRouter = Router();

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const text = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const email = z.preprocess(
  emptyToNull,
  z.string().trim().max(200).email('Enter a valid email address').nullable().optional(),
);

const url = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(300)
    .url('Enter a full URL, starting with https://')
    .refine((v) => /^https?:\/\//i.test(v), 'Only http(s) links are allowed')
    .nullable()
    .optional(),
);

const updateSchema = z
  .object({
    site_name: z.string().trim().min(1, 'Site name is required').max(80).optional(),
    tagline: text(160),
    contact_email: email,
    phone: text(40),
    location: text(120),
    linkedin_url: url,
    github_url: url,
    x_url: url,
    default_meta_title: text(70),
    default_meta_description: text(180),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

settingsAdminRouter.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('singleton', true)
    .maybeSingle();

  if (error) {
    console.error('[admin/settings]', error);
    return res.status(500).json({ error: 'Could not load settings' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Settings row missing. Run migrations/006_admin_redesign.sql and 007_admin_runtime_schema.sql.' });
  }
  res.json(data);
});

settingsAdminRouter.patch('/', async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: 'Check the highlighted fields', fields: parsed.error.flatten().fieldErrors });
  }

  const { data, error } = await supabase
    .from('site_settings')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('singleton', true)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[admin/settings]', error);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
  if (!data) {
    return res.status(404).json({ error: 'Settings row missing. Run migrations/006_admin_redesign.sql and 007_admin_runtime_schema.sql.' });
  }
  res.json(data);
});
