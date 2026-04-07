alter table public.reservations
  add column if not exists address_number text,
  add column if not exists neighborhood text;
