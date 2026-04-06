create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('client', 'admin', 'sindico');
  end if;
  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type reservation_status as enum (
      'draft',
      'submitted',
      'in_review',
      'confirmed',
      'cancelled',
      'completed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_plan_type') then
    create type payment_plan_type as enum ('installments', 'deposit', 'pix');
  end if;
  if not exists (select 1 from pg_type where typname = 'cashback_status') then
    create type cashback_status as enum ('pending', 'approved', 'cancelled');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role user_role not null default 'client',
  referral_code text not null unique,
  referred_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.condominiums (
  id uuid primary key default gen_random_uuid(),
  syndic_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.equipment_prices (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipments (id) on delete cascade,
  price_per_hour_cents int not null,
  min_hours int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (equipment_id)
);

create table if not exists public.pricing_settings (
  key text primary key,
  value_json jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event_date date,
  start_time time,
  duration_hours int,
  distance_km numeric(8, 2),
  region text,
  subtotal_cents int not null default 0,
  displacement_cents int not null default 0,
  discount_cents int not null default 0,
  total_cents int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  equipment_id uuid not null references public.equipments (id),
  quantity int not null,
  unit_price_cents int not null,
  line_total_cents int not null
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete set null,
  condominium_id uuid references public.condominiums (id) on delete set null,
  status reservation_status not null default 'submitted',
  event_name text,
  venue_name text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  notes text,
  payment_plan payment_plan_type not null,
  payment_terms jsonb not null default '{}'::jsonb,
  total_cents int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null references public.profiles (id) on delete cascade,
  condominium_id uuid references public.condominiums (id) on delete set null,
  reservation_id uuid references public.reservations (id) on delete set null,
  cashback_cents int not null default 1000,
  status cashback_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (referred_id, reservation_id)
);

create table if not exists public.cashback_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.profiles (id) on delete cascade,
  owner_condominium_id uuid references public.condominiums (id) on delete cascade,
  amount_cents int not null,
  status cashback_status not null default 'pending',
  source_referral_id uuid references public.referrals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_referral_id),
  constraint cashback_owner_one check (
    (owner_profile_id is not null and owner_condominium_id is null)
    or (owner_profile_id is null and owner_condominium_id is not null)
  )
);

create or replace function public.is_admin() returns boolean
language sql stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

create or replace function public.is_sindico() returns boolean
language sql stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'sindico'
  );
$$;

create or replace function public.generate_referral_code() returns text
language plpgsql
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
    exit when not exists (select 1 from public.profiles where referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref_code text;
  v_referred_by uuid;
  v_input_ref text;
begin
  v_ref_code := public.generate_referral_code();

  v_input_ref := nullif(new.raw_user_meta_data->>'ref', '');
  v_referred_by := null;
  if v_input_ref is not null then
    select p.id into v_referred_by
    from public.profiles p
    where p.referral_code = v_input_ref;
  end if;

  insert into public.profiles (id, referral_code, referred_by)
  values (new.id, v_ref_code, v_referred_by)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.prevent_reservation_status_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'submitted') and auth.uid() is not null and not public.is_admin() then
      raise exception 'status change not allowed';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status and auth.uid() is not null and not public.is_admin() then
      raise exception 'status change not allowed';
    end if;
    return new;
  end if;

  return new;
end;
$$;

create or replace function public.award_cashback_on_reservation_completed() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_referrer_role user_role;
  v_condominium_id uuid;
  v_referral_id uuid;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status <> 'completed' or old.status = 'completed' then
    return new;
  end if;

  select p.referred_by into v_referrer_id
  from public.profiles p
  where p.id = new.user_id;

  if v_referrer_id is null then
    return new;
  end if;

  select p.role into v_referrer_role
  from public.profiles p
  where p.id = v_referrer_id;

  v_condominium_id := null;
  if v_referrer_role = 'sindico' then
    v_condominium_id := new.condominium_id;
    if v_condominium_id is null then
      raise exception 'condominium_id required for sindico referral';
    end if;
  end if;

  insert into public.referrals (referrer_id, referred_id, condominium_id, reservation_id, cashback_cents, status)
  values (v_referrer_id, new.user_id, v_condominium_id, new.id, 1000, 'pending')
  on conflict (referred_id, reservation_id) do update
  set reservation_id = excluded.reservation_id
  returning id into v_referral_id;

  if v_referrer_role = 'sindico' then
    insert into public.cashback_transactions (
      owner_condominium_id,
      amount_cents,
      status,
      source_referral_id
    )
    values (v_condominium_id, 1000, 'pending', v_referral_id)
    on conflict (source_referral_id) do nothing;
  else
    insert into public.cashback_transactions (
      owner_profile_id,
      amount_cents,
      status,
      source_referral_id
    )
    values (v_referrer_id, 1000, 'pending', v_referral_id)
    on conflict (source_referral_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

drop trigger if exists reservations_prevent_status_change on public.reservations;
create trigger reservations_prevent_status_change
before insert or update on public.reservations
for each row execute procedure public.prevent_reservation_status_change();

drop trigger if exists reservations_award_cashback on public.reservations;
create trigger reservations_award_cashback
after update on public.reservations
for each row execute procedure public.award_cashback_on_reservation_completed();

alter table public.profiles enable row level security;
alter table public.condominiums enable row level security;
alter table public.equipments enable row level security;
alter table public.equipment_prices enable row level security;
alter table public.pricing_settings enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.reservations enable row level security;
alter table public.referrals enable row level security;
alter table public.cashback_transactions enable row level security;

create policy "profiles_self_select" on public.profiles
for select
using (id = auth.uid() or public.is_admin());

create policy "profiles_self_update" on public.profiles
for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "equipments_public_select" on public.equipments
for select
using (active = true or public.is_admin());

create policy "equipment_prices_public_select" on public.equipment_prices
for select
using (public.is_admin() or exists (
  select 1
  from public.equipments e
  where e.id = equipment_prices.equipment_id
    and e.active = true
));

create policy "pricing_settings_public_select" on public.pricing_settings
for select
using (true);

create policy "equipments_admin_write" on public.equipments
for all
using (public.is_admin())
with check (public.is_admin());

create policy "equipment_prices_admin_write" on public.equipment_prices
for all
using (public.is_admin())
with check (public.is_admin());

create policy "pricing_settings_admin_write" on public.pricing_settings
for all
using (public.is_admin())
with check (public.is_admin());

create policy "quotes_owner_select" on public.quotes
for select
using (user_id = auth.uid() or public.is_admin());

create policy "quotes_owner_insert" on public.quotes
for insert
with check (user_id = auth.uid() or public.is_admin());

create policy "quotes_owner_update" on public.quotes
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "quote_items_owner_all" on public.quote_items
for all
using (
  public.is_admin()
  or exists (
    select 1
    from public.quotes q
    where q.id = quote_items.quote_id
      and q.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.quotes q
    where q.id = quote_items.quote_id
      and q.user_id = auth.uid()
  )
);

create policy "reservations_owner_select" on public.reservations
for select
using (user_id = auth.uid() or public.is_admin());

create policy "reservations_owner_insert" on public.reservations
for insert
with check (user_id = auth.uid() or public.is_admin());

create policy "reservations_owner_update" on public.reservations
for update
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

create policy "condominiums_sindico_select" on public.condominiums
for select
using (syndic_id = auth.uid() or public.is_admin());

create policy "condominiums_sindico_write" on public.condominiums
for all
using (public.is_admin() or (public.is_sindico() and syndic_id = auth.uid()))
with check (public.is_admin() or (public.is_sindico() and syndic_id = auth.uid()));

create policy "referrals_admin_select" on public.referrals
for select
using (public.is_admin() or referrer_id = auth.uid() or referred_id = auth.uid());

create policy "referrals_admin_write" on public.referrals
for all
using (public.is_admin())
with check (public.is_admin());

create policy "cashback_owner_select" on public.cashback_transactions
for select
using (
  public.is_admin()
  or owner_profile_id = auth.uid()
  or exists (
    select 1
    from public.condominiums c
    where c.id = cashback_transactions.owner_condominium_id
      and c.syndic_id = auth.uid()
  )
);

create policy "cashback_admin_write" on public.cashback_transactions
for all
using (public.is_admin())
with check (public.is_admin());
