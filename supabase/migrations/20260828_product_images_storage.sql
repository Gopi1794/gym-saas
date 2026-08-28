-- Product image uploads live in a public catalogue bucket.
-- Objects are scoped as {gym_id}/{product_id}/{random}.{ext}.

alter table public.product_images
  add column if not exists storage_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload product images in their gym" on storage.objects;
drop policy if exists "Admins update product images in their gym" on storage.objects;
drop policy if exists "Admins delete product images in their gym" on storage.objects;

create policy "Admins upload product images in their gym"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles p
    join public.products pr on pr.gym_id = p.gym_id
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and (storage.foldername(name))[1] = p.gym_id::text
      and pr.id::text = (storage.foldername(name))[2]
  )
);

create policy "Admins update product images in their gym"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles p
    join public.products pr on pr.gym_id = p.gym_id
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and (storage.foldername(name))[1] = p.gym_id::text
      and pr.id::text = (storage.foldername(name))[2]
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles p
    join public.products pr on pr.gym_id = p.gym_id
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and (storage.foldername(name))[1] = p.gym_id::text
      and pr.id::text = (storage.foldername(name))[2]
  )
);

create policy "Admins delete product images in their gym"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.profiles p
    join public.products pr on pr.gym_id = p.gym_id
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and (storage.foldername(name))[1] = p.gym_id::text
      and pr.id::text = (storage.foldername(name))[2]
  )
);
