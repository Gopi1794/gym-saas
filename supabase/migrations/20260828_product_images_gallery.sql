-- Product image gallery.
-- products.image_url remains the primary/legacy image for compatibility.

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists product_images_one_primary_uidx
  on public.product_images(product_id)
  where is_primary = true;

create index if not exists product_images_product_id_sort_idx
  on public.product_images(product_id, sort_order);
create index if not exists product_images_gym_id_idx
  on public.product_images(gym_id);

alter table public.product_images enable row level security;

drop policy if exists "staff read product images in gym" on public.product_images;
create policy "staff read product images in gym" on public.product_images
  for select
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = product_images.gym_id
      and p.role in ('admin', 'trainer')
  ));

drop policy if exists "admins manage product images in gym" on public.product_images;
create policy "admins manage product images in gym" on public.product_images
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = product_images.gym_id
      and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = product_images.gym_id
      and p.role = 'admin'
  ));

revoke all on public.product_images from anon, authenticated;
grant select, insert, update, delete on public.product_images to authenticated;
grant all on public.product_images to service_role;
