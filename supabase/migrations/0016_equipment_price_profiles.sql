alter table public.equipment_prices
  add column if not exists price_per_day_cents int,
  add column if not exists price_per_day_block_cents int;
