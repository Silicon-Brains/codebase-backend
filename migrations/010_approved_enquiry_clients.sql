-- Approved enquiries can be prepared as client records before the client has
-- registered a Clerk account. Registration later attaches their Clerk ID.
alter table public.profiles
  alter column clerk_user_id drop not null,
  add column if not exists source_lead_id uuid references public.leads(id) on delete set null;

create unique index if not exists profiles_source_lead_id_uidx
  on public.profiles (source_lead_id);

notify pgrst, 'reload schema';
