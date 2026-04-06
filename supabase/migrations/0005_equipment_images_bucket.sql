insert into storage.buckets (id, name, public)
values ('equipment-images', 'equipment-images', true)
on conflict (id) do update set name = excluded.name, public = excluded.public;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'equipment_images_public_read'
  ) then
    create policy "equipment_images_public_read"
    on storage.objects
    for select
    using (bucket_id = 'equipment-images');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'equipment_images_admin_insert'
  ) then
    create policy "equipment_images_admin_insert"
    on storage.objects
    for insert
    with check (bucket_id = 'equipment-images' and public.is_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'equipment_images_admin_update'
  ) then
    create policy "equipment_images_admin_update"
    on storage.objects
    for update
    using (bucket_id = 'equipment-images' and public.is_admin())
    with check (bucket_id = 'equipment-images' and public.is_admin());
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'equipment_images_admin_delete'
  ) then
    create policy "equipment_images_admin_delete"
    on storage.objects
    for delete
    using (bucket_id = 'equipment-images' and public.is_admin());
  end if;
end $$;
