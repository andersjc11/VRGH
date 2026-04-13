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
  v_ref_code text;
  v_cashback_cents integer;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status not in ('confirmed', 'completed') then
    return new;
  end if;

  if old.status in ('confirmed', 'completed') then
    return new;
  end if;

  select p.referred_by into v_referrer_id
  from public.profiles p
  where p.id = new.user_id;

  if v_referrer_id is null then
    select upper(trim(coalesce(u.raw_user_meta_data->>'ref', ''))) into v_ref_code
    from auth.users u
    where u.id = new.user_id;

    if v_ref_code <> '' then
      select p.id into v_referrer_id
      from public.profiles p
      where p.referral_code = v_ref_code
      limit 1;

      if v_referrer_id is not null and v_referrer_id <> new.user_id then
        update public.profiles
        set referred_by = v_referrer_id
        where id = new.user_id
          and referred_by is null;
      end if;
    end if;
  end if;

  if v_referrer_id is null or v_referrer_id = new.user_id then
    return new;
  end if;

  select p.role into v_referrer_role
  from public.profiles p
  where p.id = v_referrer_id;

  v_condominium_id := null;
  if v_referrer_role = 'sindico' then
    v_condominium_id := new.condominium_id;
  end if;

  -- 5% of total value
  v_cashback_cents := floor(new.total_cents * 0.05);

  insert into public.referrals (referrer_id, referred_id, condominium_id, reservation_id, cashback_cents, status)
  values (v_referrer_id, new.user_id, v_condominium_id, new.id, v_cashback_cents, 'approved')
  on conflict (referred_id, reservation_id) do update
  set
    referrer_id = excluded.referrer_id,
    condominium_id = excluded.condominium_id,
    cashback_cents = excluded.cashback_cents,
    status = 'approved'
  returning id into v_referral_id;

  if v_referrer_role = 'sindico' and v_condominium_id is not null then
    insert into public.cashback_transactions (
      owner_condominium_id,
      amount_cents,
      status,
      source_referral_id
    )
    values (v_condominium_id, v_cashback_cents, 'approved', v_referral_id)
    on conflict (source_referral_id) do update
    set
      owner_condominium_id = excluded.owner_condominium_id,
      amount_cents = excluded.amount_cents,
      status = 'approved',
      updated_at = now();
  else
    insert into public.cashback_transactions (
      owner_profile_id,
      amount_cents,
      status,
      source_referral_id
    )
    values (v_referrer_id, v_cashback_cents, 'approved', v_referral_id)
    on conflict (source_referral_id) do update
    set
      owner_profile_id = excluded.owner_profile_id,
      amount_cents = excluded.amount_cents,
      status = 'approved',
      updated_at = now();
  end if;

  return new;
end;
$$;