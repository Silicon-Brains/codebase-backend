-- 004_ops_telemetry.sql
-- Admin Command Center: operational telemetry shown on /admin.
-- Same convention as 001_init.sql — RLS on, NO policies (service-role only, rules.md #1/#2).

create table ops_kpis (
  id uuid primary key default gen_random_uuid(),
  metric text not null unique,   -- active_engagements | cluster_health | velocity | mrr
  label text not null,
  value_label text not null,
  sub_label text,
  detail text,
  sub_detail text,
  trend text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table ops_clusters (
  id uuid primary key default gen_random_uuid(),
  client_profile_id uuid references profiles(id) on delete cascade,
  client_project_id uuid references client_projects(id) on delete set null,
  node_name text not null,
  initials text,
  tier text,
  region text,
  node_count int default 0,
  throughput_label text,
  latency_label text,
  active_sprint text,
  status text not null default 'nominal'
    check (status in ('operational','stabilized','real-time','nominal','degraded','down')),
  sla_percent numeric(5,2),
  detail_line text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table ops_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  repo_name text not null,
  title text,
  commit_sha text,
  branch text,
  tests_summary text,
  status text not null default 'passed'
    check (status in ('passed','running','failed','queued')),
  progress_percent int default 100,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table ops_squads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  utilization_percent int not null default 0,
  headcount int default 0,
  description text,
  sort_order int default 0,
  created_at timestamptz default now()
);

create table ops_security_items (
  id uuid primary key default gen_random_uuid(),
  icon text,          -- shield | lock | scan
  title text not null,
  description text,
  badge text,         -- "SOC2 Type II"
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table ops_kpis enable row level security;
alter table ops_clusters enable row level security;
alter table ops_pipeline_runs enable row level security;
alter table ops_squads enable row level security;
alter table ops_security_items enable row level security;
-- No policies: service-role only.