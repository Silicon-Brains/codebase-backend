-- Phase 3: unique constraints so the seed script (src/scripts/seed.ts) can
-- upsert `faqs` and `process_steps` idempotently. `services` and `projects`
-- already have this via their `slug unique` column from 001_init.sql.

alter table process_steps
  add constraint process_steps_phase_number_key unique (phase_number);

alter table faqs
  add constraint faqs_page_sort_order_key unique (page, sort_order);
