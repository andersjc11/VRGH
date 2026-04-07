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

  if new.status in ('confirmed', 'completed') then
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
    values (v_referrer_id, new.user_id, v_condominium_id, new.id, 1000, 'approved')
    on conflict (referred_id, reservation_id) do update
    set status = 'approved'
    returning id into v_referral_id;

    if v_referrer_role = 'sindico' then
      insert into public.cashback_transactions (
        owner_condominium_id,
        amount_cents,
        status,
        source_referral_id
      )
      values (v_condominium_id, 1000, 'approved', v_referral_id)
      on conflict (source_referral_id) do update
      set status = 'approved',
          amount_cents = excluded.amount_cents;
    else
      insert into public.cashback_transactions (
        owner_profile_id,
        amount_cents,
        status,
        source_referral_id
      )
      values (v_referrer_id, 1000, 'approved', v_referral_id)
      on conflict (source_referral_id) do update
      set status = 'approved',
          amount_cents = excluded.amount_cents;
    end if;

    return new;
  end if;

  if new.status = 'cancelled' then
    select r.id into v_referral_id
    from public.referrals r
    where r.referred_id = new.user_id
      and r.reservation_id = new.id
    limit 1;

    if v_referral_id is null then
      return new;
    end if;

    update public.referrals
    set status = 'cancelled'
    where id = v_referral_id;

    update public.cashback_transactions
    set status = 'cancelled'
    where source_referral_id = v_referral_id;

    return new;
  end if;

  return new;
end;
$$;

