alter table public.profiles
  add column if not exists cpf text,
  add column if not exists address_line1 text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists postal_code text,
  add column if not exists whatsapp text;

