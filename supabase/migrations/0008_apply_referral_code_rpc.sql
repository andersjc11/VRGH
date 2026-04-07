create or replace function public.apply_referral_code(ref_code text) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_referrer_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_ref := upper(trim(coalesce(ref_code, '')));
  if v_ref = '' then
    return false;
  end if;

  select p.id into v_referrer_id
  from public.profiles p
  where p.referral_code = v_ref
  limit 1;

  if v_referrer_id is null or v_referrer_id = auth.uid() then
    return false;
  end if;

  update public.profiles
  set referred_by = v_referrer_id
  where id = auth.uid()
    and referred_by is null;

  return found;
end;
$$;

grant execute on function public.apply_referral_code(text) to authenticated;

