-- Generate invoice numbers in the database so concurrent admin requests cannot
-- receive the same sequential number.
create sequence if not exists public.invoice_number_seq;

-- Start after both existing invoice numbers and any values already consumed by
-- the sequence. This remains safe if the migration is reapplied.
select setval(
  'public.invoice_number_seq'::regclass,
  greatest(
    1,
    coalesce((
      select max(substring(invoice_number from '^SB-INV-([0-9]+)$')::bigint) + 1
      from public.invoices
      where invoice_number ~ '^SB-INV-[0-9]+$'
    ), 1),
    (select last_value + case when is_called then 1 else 0 end from public.invoice_number_seq)
  ),
  false
);

create or replace function public.assign_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or btrim(new.invoice_number) = '' then
    new.invoice_number := 'SB-INV-' || lpad(nextval('public.invoice_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_assign_number on public.invoices;
create trigger invoices_assign_number
before insert on public.invoices
for each row execute function public.assign_invoice_number();

notify pgrst, 'reload schema';
