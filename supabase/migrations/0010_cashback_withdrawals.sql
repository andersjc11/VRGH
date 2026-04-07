do $$
begin
  if not exists (select 1 from pg_type where typname = 'cashback_withdrawal_status') then
    create type cashback_withdrawal_status as enum ('requested', 'paid', 'cancelled');
  end if;
end $$;

create table if not exists public.cashback_withdrawals (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents int not null,
  pix_key text not null,
  status cashback_withdrawal_status not null default 'requested',
  receipt_url text,
  paid_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cashback_withdrawals_amount_positive check (amount_cents > 0)
);

create unique index if not exists cashback_withdrawals_one_open_request
on public.cashback_withdrawals (requester_id)
where status = 'requested';

alter table public.cashback_withdrawals enable row level security;

create policy "cashback_withdrawals_select" on public.cashback_withdrawals
for select
using (public.is_admin() or requester_id = auth.uid());

create policy "cashback_withdrawals_insert" on public.cashback_withdrawals
for insert
with check (requester_id = auth.uid());

create policy "cashback_withdrawals_admin_update" on public.cashback_withdrawals
for update
using (public.is_admin())
with check (public.is_admin());

