alter table public.equipments
  add column if not exists quantity_total int not null default 1;

create or replace function public.get_equipment_availability(
  event_date date,
  start_time time,
  duration_hours int
)
returns table (
  equipment_id uuid,
  total_qty int,
  reserved_qty int,
  available_qty int
)
language sql
security definer
set search_path = public
as $$
  select * from public.get_equipment_availability(event_date, start_time, duration_hours, 0);
$$;

create or replace function public.get_equipment_availability(
  event_date date,
  start_time time,
  duration_hours int,
  distance_km numeric default 0
)
returns table (
  equipment_id uuid,
  total_qty int,
  reserved_qty int,
  available_qty int
)
language sql
security definer
set search_path = public
as $$
  with params as (
    select
      case
        when coalesce(distance_km, 0) > 70 then event_date::timestamp
        when coalesce(distance_km, 0) > 30 then (event_date::timestamp + start_time - make_interval(mins => 180))
        else (event_date::timestamp + start_time - make_interval(mins => 90))
      end as start_ts,
      case
        when coalesce(distance_km, 0) > 70 then (event_date::timestamp + interval '1 day')
        else (event_date::timestamp + start_time + make_interval(hours => greatest(duration_hours, 0)))
      end as end_ts
  ),
  reservations_with_block as (
    select
      r.quote_id,
      case
        when coalesce(q.distance_km, 0) > 70 then q.event_date::timestamp
        when coalesce(q.distance_km, 0) > 30 then (q.event_date::timestamp + q.start_time - make_interval(mins => 180))
        else (q.event_date::timestamp + q.start_time - make_interval(mins => 90))
      end as blocked_start_ts,
      case
        when coalesce(q.distance_km, 0) > 70 then (q.event_date::timestamp + interval '1 day')
        else (q.event_date::timestamp + q.start_time + make_interval(hours => greatest(q.duration_hours, 0)))
      end as blocked_end_ts
    from public.reservations r
    join public.quotes q on q.id = r.quote_id
    where r.status in ('confirmed', 'completed')
      and q.event_date is not null
      and q.start_time is not null
      and q.duration_hours is not null
  ),
  overlapping_reservations as (
    select rb.quote_id
    from reservations_with_block rb
    join params p on true
    where rb.blocked_start_ts < p.end_ts
      and rb.blocked_end_ts > p.start_ts
  ),
  reserved as (
    select
      qi.equipment_id,
      sum(qi.quantity)::int as reserved_qty
    from public.quote_items qi
    where qi.quote_id in (select quote_id from overlapping_reservations)
    group by qi.equipment_id
  )
  select
    e.id as equipment_id,
    e.quantity_total as total_qty,
    coalesce(r.reserved_qty, 0) as reserved_qty,
    greatest(e.quantity_total - coalesce(r.reserved_qty, 0), 0) as available_qty
  from public.equipments e
  left join reserved r on r.equipment_id = e.id
  where e.active = true
  order by e.created_at asc;
$$;

revoke all on function public.get_equipment_availability(date, time, int) from public;
grant execute on function public.get_equipment_availability(date, time, int) to anon, authenticated;
revoke all on function public.get_equipment_availability(date, time, int, numeric) from public;
grant execute on function public.get_equipment_availability(date, time, int, numeric) to anon, authenticated;
