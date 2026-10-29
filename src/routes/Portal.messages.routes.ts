import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { MESSAGES_PAGE_LIMIT, messageBodySchema, uuidSchema } from '../lib/messages.js';

/**
 * Client-side half of messaging. Mount from portal.routes.ts (already behind
 * requireAuth + requireRole('client')):
 *
 *   import { portalMessagesRouter } from './portal.messages.routes';
 *   router.use('/messages', portalMessagesRouter);
 *
 * Rule 4: never trust a client-supplied engagement id. Every handler verifies the engagement
 * belongs to req.profile.id first, and answers 404 (not 403) so existence isn't leaked.
 */
export const portalMessagesRouter = Router();

const profileIdOf = (req: unknown) => (req as { profile: { id: string } }).profile.id;

function fail(res: any, error: unknown) {
  console.error('[portal/messages]', error);
  return res.status(500).json({ error: 'Something went wrong. Try again.' });
}

async function ownsProject(projectId: string, profileId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('client_projects')
    .select('id')
    .eq('id', projectId)
    .eq('client_profile_id', profileId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

portalMessagesRouter.get('/:projectId', async (req, res) => {
  if (!uuidSchema.safeParse(req.params.projectId).success) return res.status(404).json({ error: 'Not found' });
  try {
    if (!(await ownsProject(req.params.projectId, profileIdOf(req)))) return res.status(404).json({ error: 'Not found' });

    const { data, error } = await supabase
      .from('engagement_messages')
      .select('id, client_project_id, sender_role, body, read_at, created_at')
      .eq('client_project_id', req.params.projectId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_LIMIT);
    if (error) throw error;
    res.json((data ?? []).reverse());
  } catch (error) {
    fail(res, error);
  }
});

portalMessagesRouter.post('/:projectId', async (req, res) => {
  if (!uuidSchema.safeParse(req.params.projectId).success) return res.status(404).json({ error: 'Not found' });
  const parsed = messageBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    const profileId = profileIdOf(req);
    if (!(await ownsProject(req.params.projectId, profileId))) return res.status(404).json({ error: 'Not found' });

    const { data, error } = await supabase
      .from('engagement_messages')
      .insert({
        client_project_id: req.params.projectId,
        sender_profile_id: profileId,
        sender_role: 'client',
        body: parsed.data.body,
      })
      .select('id, client_project_id, sender_role, body, read_at, created_at')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    fail(res, error);
  }
});

// Mark the team's messages as read by the client.
portalMessagesRouter.patch('/:projectId/read', async (req, res) => {
  if (!uuidSchema.safeParse(req.params.projectId).success) return res.status(404).json({ error: 'Not found' });
  try {
    if (!(await ownsProject(req.params.projectId, profileIdOf(req)))) return res.status(404).json({ error: 'Not found' });

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('engagement_messages')
      .update({ read_at: now, updated_at: now })
      .eq('client_project_id', req.params.projectId)
      .eq('sender_role', 'admin')
      .is('read_at', null);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    fail(res, error);
  }
});