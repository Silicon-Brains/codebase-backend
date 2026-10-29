-- Fields needed to generate a branded invoice document from a saved invoice.
alter table public.invoices
  add column if not exists line_items jsonb not null default '[]'::jsonb,
  add column if not exists po_ref text,
  add column if not exists discount_percent numeric not null default 0,
  add column if not exists other_charges numeric not null default 0,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists billed_to_name text,
  add column if not exists billed_to_company text,
  add column if not exists billed_to_email text,
  add column if not exists billed_to_phone text,
  add column if not exists billed_to_address text,
  add column if not exists bank_account_name text,
  add column if not exists bank_branch text,
  add column if not exists bank_account_no text,
  add column if not exists bank_ifsc_swift text,
  add column if not exists upi_id text,
  add column if not exists cheque_in_favour text,
  add column if not exists payment_link text,
  add column if not exists late_fee_percent numeric;

alter table public.invoices
  drop constraint if exists invoices_payment_status_check,
  add constraint invoices_payment_status_check
    check (payment_status in ('unpaid', 'partial', 'paid')),
  drop constraint if exists invoices_discount_percent_check,
  add constraint invoices_discount_percent_check
    check (discount_percent >= 0 and discount_percent <= 100),
  drop constraint if exists invoices_other_charges_check,
  add constraint invoices_other_charges_check
    check (other_charges >= 0),
  drop constraint if exists invoices_late_fee_percent_check,
  add constraint invoices_late_fee_percent_check
    check (late_fee_percent is null or (late_fee_percent >= 0 and late_fee_percent <= 100));

notify pgrst, 'reload schema';
