-- supabase/migrations/20260808_quick_log_meal_photo.sql

-- 1. quick_log_entries: vínculo opcional a la comida del plan + foto persistida
alter table quick_log_entries
  add column meal_id uuid references nutrition_meals(id) on delete set null,
  add column photo_url text;

-- 2. Bucket food-photos — privado (a diferencia de avatar/exercise-images).
-- Path: {user_id}/{uuid}.jpg
insert into storage.buckets (id, name, public)
values ('food-photos', 'food-photos', false)
on conflict (id) do update set public = false;

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
