-- Storage bucket for AI-generated and manually uploaded exercise images

insert into storage.buckets (id, name, public)
values ('exercise-images', 'exercise-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Exercise images are publicly readable" on storage.objects;
create policy "Exercise images are publicly readable"
on storage.objects for select
using (bucket_id = 'exercise-images');

drop policy if exists "Admins can upload exercise images" on storage.objects;
create policy "Admins can upload exercise images"
on storage.objects for insert
with check (
  bucket_id = 'exercise-images'
  and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'trainer')
  )
);

drop policy if exists "Admins can update exercise images" on storage.objects;
create policy "Admins can update exercise images"
on storage.objects for update
using (
  bucket_id = 'exercise-images'
  and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'trainer')
  )
)
with check (
  bucket_id = 'exercise-images'
  and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'trainer')
  )
);

drop policy if exists "Admins can delete exercise images" on storage.objects;
create policy "Admins can delete exercise images"
on storage.objects for delete
using (
  bucket_id = 'exercise-images'
  and exists (
    select 1 from profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'trainer')
  )
);
