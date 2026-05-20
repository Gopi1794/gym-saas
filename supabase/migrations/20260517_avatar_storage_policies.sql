-- Avatar storage bucket and row-level security policies.
-- Files are stored as: {user_id}/avatar.{ext}

insert into storage.buckets (id, name, public)
values ('avatar', 'avatar', true)
on conflict (id) do update set public = true;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
on storage.objects
for select
using (bucket_id = 'avatar');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects
for insert
with check (
  bucket_id = 'avatar'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects
for update
using (
  bucket_id = 'avatar'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatar'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects
for delete
using (
  bucket_id = 'avatar'
  and auth.uid()::text = (storage.foldername(name))[1]
);
