-- 006_admin_redesign.sql
-- New tables the redesigned admin panel needs. All service-role-only (no policies,
-- RLS on) — same convention as 001 and 004.

-- Project lifecycle status (dashboard's "Project Status" donut + Projects page badges).
alter table client_projects
  add column if not exists status text not null default 'ongoing'
    check (status in ('ongoing','completed','planning','on_hold','cancelled'));

-- Internal team (Users page). Separate from `profiles`, which is client-only.
create table team_members (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique,
  full_name text not null,
  email text not null,
  role text not null default 'developer'
    check (role in ('admin','project_manager','developer','designer','tester','content_writer')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  last_active_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Blog (Blog page).
create table blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  category text,
  author text,
  excerpt text,
  body text,
  status text not null default 'draft' check (status in ('draft','published')),
  views int default 0,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Messages (Messages page + dashboard "Recent Messages" + unread KPI).
create table message_threads (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  subject text,
  from_name text not null,
  from_email text not null,
  unread boolean not null default true,
  last_message_at timestamptz default now(),
  created_at timestamptz default now()
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  from_name text,
  body text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Quick tasks (dashboard "Upcoming Tasks" + quick-actions popover).
create table quick_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  project_id uuid references client_projects(id) on delete set null,
  due_date date,
  done boolean not null default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Site-wide settings (Settings page). Single-row per key, JSON value.
create table site_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb,
  updated_at timestamptz default now()
);

-- RLS on for all new tables — no policies, service role only.
alter table team_members   enable row level security;
alter table blog_posts     enable row level security;
alter table message_threads enable row level security;
alter table messages       enable row level security;
alter table quick_tasks    enable row level security;
alter table site_settings  enable row level security;

-- Optional seed: uncomment to give the dashboard some data on first boot.
-- insert into quick_tasks (title, due_date, sort_order) values
--   ('Follow up with Rahul Sharma',           current_date + 2, 1),
--   ('Send proposal to NeuroVenture Health',  current_date + 4, 2),
--   ('Design review for GymPro v2.4',         current_date + 5, 3),
--   ('Follow up with DeepMind AI',            current_date + 6, 4),
--   ('Client meeting – MedFlow',              current_date + 7, 5);