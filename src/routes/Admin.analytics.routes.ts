import { Router } from 'express';
import { z } from 'zod';
import { supabase } from '../lib/supabase.js';

/**
 * Mounted from admin.routes.ts (already behind requireAuth + requireRole('admin')):
 *
 *   import { analyticsAdminRouter } from './admin.analytics.routes';
 *   router.use('/analytics', analyticsAdminRouter);
 *
 * Read-only. Business metrics computed from leads, profiles, client_projects, invoices and
 * engagement_messages. There is no website-traffic data in the database.
 */
export const analyticsAdminRouter = Router();

const DAY_MS = 86_400_000;
const PAGE = 1000; // Supabase returns at most 1000 rows per request, so page through results.

const querySchema = z.object({
  days: z.coerce
    .number()
    .refine((v) => [30, 90, 365].includes(v), 'days must be 30, 90 or 365')
    .default(30),
});

async function fetchAll<T = any>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await build(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

function tally(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

analyticsAdminRouter.get('/', async (req, res) => {
  const q = querySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.issues[0].message });
  const days = q.data.days;

  const now = Date.now();
  const since = now - days * DAY_MS;
  const prevSince = now - 2 * days * DAY_MS;

  try {
    const [leads, clients, projects, invoices, unread, messagesInRange] = await Promise.all([
      fetchAll<{ created_at: string; status: string; domain_interest: string[] | null; budget_range: string | null }>(
        (a, b) =>
          supabase
            .from('leads')
            .select('created_at, status, domain_interest, budget_range')
            .gte('created_at', new Date(prevSince).toISOString())
            .order('created_at', { ascending: true })
            .range(a, b),
      ),
      fetchAll<{ created_at: string }>((a, b) =>
        supabase
          .from('profiles')
          .select('created_at')
          .eq('role', 'client')
          .gte('created_at', new Date(prevSince).toISOString())
          .order('created_at', { ascending: true })
          .range(a, b),
      ),
      fetchAll<{ current_phase: number | null; progress_percent: number | null }>((a, b) =>
        supabase.from('client_projects').select('current_phase, progress_percent').order('id').range(a, b),
      ),
      fetchAll<{ amount: number | string; currency: string | null; status: string }>((a, b) =>
        supabase
          .from('invoices')
          .select('amount, currency, status')
          .gte('issued_date', new Date(since).toISOString().slice(0, 10))
          .order('issued_date', { ascending: true })
          .range(a, b),
      ),
      supabase
        .from('engagement_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_role', 'client')
        .is('read_at', null),
      supabase
        .from('engagement_messages')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(since).toISOString()),
    ]);
    if (unread.error) throw unread.error;
    if (messagesInRange.error) throw messagesInRange.error;

    const inRange = (iso: string) => new Date(iso).getTime() >= since;
    const leadsCur = leads.filter((l) => inRange(l.created_at));
    const leadsPrev = leads.length - leadsCur.length;
    const clientsCur = clients.filter((c) => inRange(c.created_at)).length;
    const clientsPrev = clients.length - clientsCur;

    // Trend buckets: daily (30d), weekly (90d), 30-day blocks (365d).
    const bucketDays = days <= 30 ? 1 : days <= 90 ? 7 : 30;
    const bucketCount = Math.ceil(days / bucketDays);
    const trend = Array.from({ length: bucketCount }, (_, i) => ({
      start: new Date(since + i * bucketDays * DAY_MS).toISOString(),
      count: 0,
    }));
    for (const l of leadsCur) {
      const idx = Math.floor((new Date(l.created_at).getTime() - since) / (bucketDays * DAY_MS));
      if (idx >= 0 && idx < bucketCount) trend[idx].count++;
    }

    const statusCounts = new Map<string, number>();
    for (const l of leadsCur) statusCounts.set(l.status, (statusCounts.get(l.status) ?? 0) + 1);
    const leadStatus = ['new', 'contacted', 'converted', 'archived'].map((status) => ({
      label: status,
      count: statusCounts.get(status) ?? 0,
    }));
    const converted = statusCounts.get('converted') ?? 0;

    const phases = [1, 2, 3, 4, 5].map((phase) => ({
      label: `Phase ${phase}`,
      count: projects.filter((p) => p.current_phase === phase).length,
    }));
    const activeEngagements = projects.filter((p) => (p.progress_percent ?? 0) < 100).length;
    const avgProgress = projects.length
      ? Math.round(projects.reduce((n, p) => n + (p.progress_percent ?? 0), 0) / projects.length)
      : 0;

    const byCurrency = new Map<string, { currency: string; paid: number; pending: number; overdue: number; count: number }>();
    for (const inv of invoices) {
      const currency = inv.currency ?? 'USD';
      const row = byCurrency.get(currency) ?? { currency, paid: 0, pending: 0, overdue: 0, count: 0 };
      const amount = Number(inv.amount) || 0;
      if (inv.status === 'paid') row.paid += amount;
      else if (inv.status === 'overdue') row.overdue += amount;
      else row.pending += amount;
      row.count++;
      byCurrency.set(currency, row);
    }

    res.json({
      range_days: days,
      generated_at: new Date(now).toISOString(),
      kpis: {
        leads: leadsCur.length,
        leads_prev: leadsPrev,
        conversion_rate: leadsCur.length ? Math.round((converted / leadsCur.length) * 1000) / 10 : null,
        new_clients: clientsCur,
        new_clients_prev: clientsPrev,
        active_engagements: activeEngagements,
        avg_progress: avgProgress,
        unread_messages: unread.count ?? 0,
        messages_in_range: messagesInRange.count ?? 0,
      },
      bucket_days: bucketDays,
      leads_trend: trend,
      lead_status: leadStatus,
      lead_domains: tally(leadsCur.flatMap((l) => l.domain_interest ?? [])).slice(0, 8),
      lead_budgets: tally(leadsCur.map((l) => l.budget_range ?? 'Not specified')).slice(0, 8),
      phases,
      invoices: [...byCurrency.values()].sort((a, b) => b.count - a.count),
    });
  } catch (error) {
    console.error('[admin/analytics]', error);
    res.status(500).json({ error: 'Could not load analytics' });
  }
});