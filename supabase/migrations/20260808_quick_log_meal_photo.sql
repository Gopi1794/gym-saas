-- supabase/migrations/20260808_quick_log_meal_photo.sql

-- 1. quick_log_entries: vínculo opcional a la comida del plan + foto persistida
alter table quick_log_entries
  add column meal_id uuid references nutrition_meals(id) on delete set null,
  add column photo_url text;

-- 2. Bucket food-photos — privado (a diferencia de avatar/exercise-images).
-- Path: {user_id}/{uuid}.{jpg|png|webp}
--
-- file_size_limit y allowed_mime_types los aplica Storage del lado del
-- servidor: son el único techo real, porque la compresión a 1024px que hace
-- el cliente (MemberChat.compressImage) es sugerencia, no control. 5 MB sobra
-- para una foto de comida comprimida. La whitelist de MIME está espejada en
-- PHOTO_EXT_BY_MIME (app/actions/nutrition-tracking.ts).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('food-photos', 'food-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Members manage their own food photos" on storage.objects;
create policy "Members manage their own food photos"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'food-photos'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'food-photos'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

drop policy if exists "Staff read food photos of their own gym" on storage.objects;
create policy "Staff read food photos of their own gym"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'food-photos'
  and exists (
    select 1 from profiles caller
    join profiles owner on owner.gym_id = caller.gym_id
    where caller.id = (select auth.uid())
      and caller.role in ('admin', 'trainer')
      and owner.id::text = (storage.foldername(name))[1]
  )
);

-- 3. Nuevo tipo de notificación — mismo patron que 20260730_notifications_weight_drift_type.sql
alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
  'new_member',
  'check_in',
  'achievement',
  'plan_assigned',
  'membership_expiring',
  'churn_alert',
  'weight_drift',
  'calorie_alert'
));
