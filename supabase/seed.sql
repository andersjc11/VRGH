insert into public.pricing_settings (key, value_json)
values
  (
    'displacement',
    jsonb_build_object(
      'base_fee_cents', 0,
      'free_km', 10,
      'per_km_cents', 500
    )
  ),
  (
    'discounts',
    jsonb_build_object(
      'pix_discount_pct', 5,
      'deposit_pct', 30,
      'max_installments', 6
    )
  )
on conflict (key) do update set value_json = excluded.value_json, updated_at = now();

with inserted as (
  insert into public.equipments (name, description, category, image_url, active)
  values
    (
      'Console + TV 55"',
      'Console (PS5/Xbox) com TV 55" 4K e 2 controles.',
      'Console',
      null,
      true
    ),
    (
      'PC Gamer + Monitor 24"',
      'PC gamer com monitor 24", teclado, mouse e headset.',
      'PC Gamer',
      null,
      true
    ),
    (
      'Simulador de corrida',
      'Cockpit, volante, pedais e TV dedicada.',
      'Simulador',
      null,
      true
    )
  returning id, name
)
insert into public.equipment_prices (equipment_id, price_per_hour_cents, min_hours)
select
  i.id,
  case
    when i.name = 'Console + TV 55"' then 25000
    when i.name = 'PC Gamer + Monitor 24"' then 30000
    else 45000
  end as price_per_hour_cents,
  4
from inserted i
on conflict (equipment_id) do update
set price_per_hour_cents = excluded.price_per_hour_cents,
    min_hours = excluded.min_hours,
    updated_at = now();

