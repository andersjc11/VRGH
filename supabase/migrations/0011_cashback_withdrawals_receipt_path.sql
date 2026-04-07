do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cashback_withdrawals'
      and column_name = 'receipt_path'
  ) then
    alter table public.cashback_withdrawals
      add column receipt_path text;
  end if;
end $$;

update public.cashback_withdrawals
set receipt_path = substring(receipt_url from 'cashback-receipts/(.*)$')
where receipt_path is null
  and receipt_url is not null
  and receipt_url like '%/cashback-receipts/%';

