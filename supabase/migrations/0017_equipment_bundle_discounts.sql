alter table public.equipment_prices
  add column if not exists discount_2_items_pct int,
  add column if not exists discount_3_items_pct int;
