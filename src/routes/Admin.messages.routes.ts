import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { MESSAGES_PAGE_LIMIT, messageBodySchema, uuidSchema } from '../lib/messages.js';

/**
 * Mounted from admin.routes.ts (already behind requireAuth + requireRole('admin')):
 *
 *   import { messagesAdminRouter } from './admin.messages.routes';
 *   router.use('/messages', messagesAdminRouter);
 *
 * A "thread" is an engagement (client_projects row). Thread id === client_project_id.
 */
export const messagesAdminRouter = Router();

const PREVIEW_LENGTH = 140;

function fail(res: any, error: unknown) {
  console.error('[admin/messages]', error);
  return res.status(500).json({ error: 'Something went wrong. Try again.' });
}

async function projectExists(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('client_projects').select('id').eq('id', id).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// All engagements with client info, last message and unread count.
messagesAdminRouter.get('/threads', async (_req, res) => {
  try {
    const { data: projects, error: pErr } = await supabase
      .from('client_projects')
      .select('id, title, client_profile_id');
    if (pErr) throw pErr;

    const profileIds = [...new Set((projects ?? []).map((p) => p.client_profile_id))];
    const { data: profiles, error: prErr } = profileIds.length
      ? await supabase.from('profiles').select('id, full_name, email, company_name').in('id', profileIds)
      : { data: [], error: null };
    if (prErr) throw prErr;

    // Exact unread counts (messages the client sent that no admin has opened yet).
    const { data: unread, error: uErr } = await supabase
      .from('engagement_messages')
      .select('client_project_id')
      .eq('sender_role', 'client')
      .is('read_at', null);
    if (uErr) throw uErr;

    // Latest message per thread, taken from the most recent messages overall.
    const { data: recent, error: rErr } = await supabase
      .from('engagement_messages')
      .select('client_project_id, sender_role, body, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (rErr) throw rErr;

    const unreadCounts = new Map<string, number>();
    for (const m of unread ?? []) {
      unreadCounts.set(m.client_project_id, (unreadCounts.get(m.client_project_id) ?? 0) + 1);
    }
    const lastByThread = new Map<string, { body: string; sender_role: string; created_at: string }>();
    for (const m of recent ?? []) {
      if (!lastByThread.has(m.client_project_id)) {
        lastByThread.set(m.client_project_id, {
          body: m.body.slice(0, PREVIEW_LENGTH),
          sender_role: m.sender_role,
          created_at: m.created_at,
        });
      }
    }
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    const threads = (projects ?? []).map((p) => {
      const profile = profileById.get(p.client_profile_id);
      return {
        id: p.id,
        title: p.title,
        client: {
          id: p.client_profile_id,
          full_name: profile?.full_name ?? null,
          email: profile?.email ?? null,
          company_name: profile?.company_name ?? null,
        },
        unread_count: unreadCounts.get(p.id) ?? 0,
        last_message: lastByThread.get(p.id) ?? null,
      };
    });

    threads.sort((a, b) => {
      if (a.last_message && b.last_message) return b.last_message.created_at.localeCompare(a.last_message.created_at);
      if (a.last_message) return -1;
      if (b.last_message) return 1;
      return a.title.localeCompare(b.title);
    });

    res.json(threads);
  } catch (error) {
    fail(res, error);
  }
});

messagesAdminRouter.get('/threads/:id/messages', async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Engagement not found' });
  try {
    if (!(await projectExists(req.params.id))) return res.status(404).json({ error: 'Engagement not found' });

    // Newest N, returned oldest-first for display.
    const { data, error } = await supabase
      .from('engagement_messages')
      .select('id, client_project_id, sender_profile_id, sender_role, body, read_at, created_at')
      .eq('client_project_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_LIMIT);
    if (error) throw error;
    res.json((data ?? []).reverse());
  } catch (error) {
    fail(res, error);
  }
});

messagesAdminRouter.post('/threads/:id/messages', async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Engagement not found' });
  const parsed = messageBodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  try {
    if (!(await projectExists(req.params.id))) return res.status(404).json({ error: 'Engagement not found' });

    const profileId = (req as unknown as { profile: { id: string } }).profile.id;
    const { data, error } = await supabase
      .from('engagement_messages')
      .insert({
        client_project_id: req.params.id,
        sender_profile_id: profileId,
        sender_role: 'admin',
        body: parsed.data.body,
      })
      .select('id, client_project_id, sender_profile_id, sender_role, body, read_at, created_at')
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    fail(res, error);
  }
});

// Mark the client's messages in this thread as read.
messagesAdminRouter.patch('/threads/:id/read', async (req, res) => {
  if (!uuidSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Engagement not found' });
  try {
    const { error } = await supabase
      .from('engagement_messages')
      .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('client_project_id', req.params.id)
      .eq('sender_role', 'client')
      .is('read_at', null);
    if (error) throw error;
    res.status(204).end();
  } catch (error) {
    fail(res, error);
  }
});