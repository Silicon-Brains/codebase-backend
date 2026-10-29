-- 005_portal_sprint.sql
-- Client Portal: sprint cycle, task board, repos, team roster, staging deploys.
-- Service-role-only, scoped to client_projects(id).

create table sprint_cycles (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid not null references client_projects(id) on delete cascade,
  sprint_label text,              -- "Sprint 07"
  dates_label text,               -- "3 Days Left"
  deliverables_done int default 0,
  deliverables_total int default 0,
  velocity_label text,            -- "84%"
  velocity_sub text,              -- "18/21 Stories"
  build_label text,               -- "v2.4.1-rc3"
  build_sub text,                 -- "142/142 Unit & E2E"
  code_delta_label text,          -- "477"
  commits_label text,             -- "5 Commits / 3 Repos"
  milestone_paid_label text,      -- "$42,500"
  milestone_total_label text,     -- "$60k"
  milestone_status text,          -- "On track"
  cve_label text,                 -- "0 CVE"
  vulnerabilities_label text,     -- "0 Critical"
  governance_label text,          -- "100%"
  governance_sub text,            -- "Transferred"
  sort_order int default 0,
  created_at timestamptz default now()
);

create table project_tasks (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid not null references client_projects(id) on delete cascade,
  title text not null,
  description text,
  engineering_status text,
  icon text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table code_repositories (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid not null references client_projects(id) on delete cascade,
  name text not null,
  description text,
  branch text,
  version_label text,
  build_label text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table repo_artifacts (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid not null references client_projects(id) on delete cascade,
  label text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table project_team_members (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid not null references client_projects(id) on delete cascade,
  full_name text not null,
  role text,
  handle text,
  status text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table staging_deployments (
  id uuid primary key default gen_random_uuid(),
  client_project_id uuid not null references client_projects(id) on delete cascade,
  name text not null,
  version_label text,
  url text,
  status text default 'ready',
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table sprint_cycles enable row level security;
alter table project_tasks enable row level security;
alter table code_repositories enable row level security;
alter table repo_artifacts enable row level security;
alter table project_team_members enable row level security;
alter table staging_deployments enable row level security;

-- Milestone billing (portal "Milestone Billing Audit" panel).
alter table milestones
  add column if not exists amount numeric,
  add column if not exists currency text default 'USD',
  add column if not exists paid_at date,
  add column if not exists paid_via text;