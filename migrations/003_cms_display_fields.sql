-- Phase 4 — columns the public pages need to render without hardcoded copy.
-- Phase 2 pages displayed fields the original schema had no home for; without
-- these, wiring pages to the CMS would silently drop visible content.

alter table services
  add column if not exists tag text,                       -- e.g. "Distributed Systems"
  add column if not exists features text[] default '{}',   -- checklist bullets on the card
  add column if not exists metric_label text,              -- e.g. "Throughput Efficiency"
  add column if not exists metric_value text;             -- e.g. "48.2k req/sec"

alter table projects
  add column if not exists tag text,                       -- display label, distinct from filter `category`
  add column if not exists highlights text[] default '{}'; -- flagship bullet points

alter table process_steps
  add column if not exists description text,               -- paragraph under the phase title
  add column if not exists artifact_label text,            -- right-hand panel title, e.g. "Topology Map"
  add column if not exists artifact_note text;             -- right-hand panel caption, e.g. "Terraform v1.5"

-- Contact form has an NDA checkbox that had no column to land in.
alter table leads
  add column if not exists nda_requested boolean not null default false;
