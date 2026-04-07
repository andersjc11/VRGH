alter table public.profiles
  add column if not exists address_number text,
  add column if not exists address_line2 text;

