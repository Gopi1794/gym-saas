-- Las policies de check_ins nunca estuvieron versionadas (no aparecían en ningún
-- archivo de supabase/migrations/) — se consultaron directo contra la base en
-- producción con `supabase db query --linked` para no adivinar. Esta migración
-- documenta el estado real encontrado y corrige dos huecos reales que tenía:
--
-- 1) Ninguna de las 4 policies declaraba `TO` — quedaban en PUBLIC por default.
-- 2) "admins can create check-ins" no validaba gym_id en absoluto: cualquier
--    admin/trainer, de cualquier gimnasio, podía insertar un check-in con un
--    gym_id ajeno. "users can create their own check-ins" tenía el mismo hueco
--    del lado del socio (validaba user_id pero no gym_id).

drop policy if exists "admins can create check-ins" on public.check_ins;
drop policy if exists "admins can see all check-ins in their gym" on public.check_ins;
drop policy if exists "users can create their own check-ins" on public.check_ins;
drop policy if exists "users can see their own check-ins" on public.check_ins;

create policy "admins can create check-ins"
on public.check_ins for insert to authenticated
with check (
  gym_id = get_my_gym_id()
  and get_my_role() = any (array['admin', 'trainer'])
);

create policy "admins can see all check-ins in their gym"
on public.check_ins for select to authenticated
using (
  gym_id = get_my_gym_id()
  and get_my_role() = any (array['admin', 'trainer'])
);

create policy "users can create their own check-ins"
on public.check_ins for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and gym_id = get_my_gym_id()
);

create policy "users can see their own check-ins"
on public.check_ins for select to authenticated
using ((select auth.uid()) = user_id);

-- Storage de imágenes de máquinas: la policy de escritura solo validaba rol
-- (admin/trainer), no que la máquina referenciada en el path (`${machineId}.${ext}`)
-- perteneciera al gym del que sube — un admin/trainer de cualquier gym podía
-- subir/pisar/borrar la imagen de una máquina de otro gym conociendo su id interno.

drop policy if exists "Staff can upload machine images" on storage.objects;
drop policy if exists "Staff can update machine images" on storage.objects;
drop policy if exists "Staff can delete machine images" on storage.objects;

create policy "Staff can upload machine images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'machine-images'
  and exists (
    select 1
    from public.profiles p
    join public.machines m on m.gym_id = p.gym_id
    where p.id = (select auth.uid())
      and p.role in ('admin', 'trainer')
      and m.id = split_part(storage.objects.name, '.', 1)::uuid
  )
);

create policy "Staff can update machine images"
on storage.objects for update to authenticated
using (
  bucket_id = 'machine-images'
  and exists (
    select 1
    from public.profiles p
    join public.machines m on m.gym_id = p.gym_id
    where p.id = (select auth.uid())
      and p.role in ('admin', 'trainer')
      and m.id = split_part(storage.objects.name, '.', 1)::uuid
  )
);

create policy "Staff can delete machine images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'machine-images'
  and exists (
    select 1
    from public.profiles p
    join public.machines m on m.gym_id = p.gym_id
    where p.id = (select auth.uid())
      and p.role in ('admin', 'trainer')
      and m.id = split_part(storage.objects.name, '.', 1)::uuid
  )
);
