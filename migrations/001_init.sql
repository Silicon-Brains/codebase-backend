-- SiliconBrains initial schema
create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text,
  full_name text,
  role text not null default 'client' check (role in ('admin','client')),
  company_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  icon text,
  category text,
  description text,
  deliverables text[] default '{}',
  architecture_baseline text[] default '{}',
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  summary text,
  category text,
  tech_stack text[] default '{}',
  metrics jsonb default '{}',
  cover_image_url text,
  featured boolean default false,
  sort_order int default 0,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table testimonials (
  id uuid primary key default gen_random_uuid(),
  author_name text not null,
  author_role text,
  company text,
  quote text not null,
  published boolean default true,
  created_at timestamptz default now()
);

create table faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  page text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table process_steps (
  id uuid primary key default gen_random_uuid(),
  phase_number int not null,
  title text not null,
  subtitle text,
  core_focus text[] default '{}',
  key_deliverables text[] default '{}',
  quality_gate text,
  created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  work_email text not null,
  organization text,
  website text,
  domain_interest text[] default '{}',
  budget_range text,
  timeline text,
  message text not null,
  status text not null default 'new' check (status in ('new','contacted','converted','archived')),
  created_at timestamptz default now()
);

create table client_projects (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid references profiles(id) on delete cascade,
  title text not null,
  current_phase int default 1,
  status_summary text,
  progress_percent int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid references client_projects(id) on delete cascade,
  title text not null,
  due_date date,
  status text default 'pending' check (status in ('pending','in_progress','done')),
  notes text,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid references client_projects(id) on delete cascade,
  invoice_number text not null,
  amount numeric not null,
  currency text default 'USD',
  status text default 'pending' check (status in ('pending','paid','overdue')),
  issued_date date,
  due_date date,
  created_at timestamptz default now()
);

-- RLS: enabled on everything; app talks through the Express service-role
-- key, so these policies mainly protect against any future anon/public
-- Supabase client usage. Public-readable content still gets a select policy
-- for completeness / future direct reads if ever needed.
alter table profiles enable row level security;
alter table services enable row level security;
alter table projects enable row level security;
alter table testimonials enable row level security;
alter table faqs enable row level security;
alter table process_steps enable row level security;
alter table leads enable row level security;
alter table client_projects enable row level security;
alter table milestones enable row level security;
alter table invoices enable row level security;

create policy "public read published services" on services for select using (published = true);
create policy "public read published projects" on projects for select using (published = true);
create policy "public read published testimonials" on testimonials for select using (published = true);
create policy "public read faqs" on faqs for select using (true);
create policy "public read process_steps" on process_steps for select using (true);
-- profiles, leads, client_projects, milestones, invoices: no public policies —
-- accessible only via the service-role key from the Express server.
