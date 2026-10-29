-- 006_messages.sql — admin <-> client messaging, one thread per engagement (client_projects row)
-- Named engagement_messages because a different public.messages table already exists in this database.
-- Plain CREATE (no "if not exists") so a clash with an existing table fails loudly.
create table public.engagement_messages (
  id                uuid primary key default gen_random_uuid(),
  client_project_id uuid not null references public.client_projects(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  sender_role       text not null check (sender_role in ('admin', 'client')),
  body              text not null check (char_length(body) between 1 and 4000),
  read_at           timestamptz,   -- set when the OTHER side has opened the message
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index engagement_messages_thread_idx on public.engagement_messages (client_project_id, created_at);
create index engagement_messages_unread_idx on public.engagement_messages (client_project_id, sender_role) where read_at is null;

-- RLS on with no policies: no direct access. Everything goes through Express
-- (admin.messages.routes.ts / portal.messages.routes.ts), which enforces access in code.
alter table public.engagement_messages enable row level security;

notify pgrst, 'reload schema';