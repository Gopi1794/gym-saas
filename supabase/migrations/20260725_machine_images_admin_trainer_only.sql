-- supabase/migrations/20260725_machine_images_admin_trainer_only.sql
-- Solo admin y trainer pueden subir, modificar o borrar imágenes de máquinas.
-- La lectura sigue siendo pública (los socios ven las fotos en la app).

drop policy if exists "Authenticated users can upload machine images" on storage.objects;
drop policy if exists "Authenticated users can update machine images" on storage.objects;

create policy "Staff can upload machine images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'machine-images'
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'trainer')
  )
);

create policy "Staff can update machine images"
on storage.objects for update to authenticated
using (
  bucket_id = 'machine-images'
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'trainer')
  )
);

create policy "Staff can delete machine images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'machine-images'
  and exists (
    select 1 from profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin', 'trainer')
  )
);