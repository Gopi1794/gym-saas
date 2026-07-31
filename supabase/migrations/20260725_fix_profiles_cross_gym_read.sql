-- La policy anterior solo validaba el rol, sin comparar gym_id:
-- cualquier admin o trainer leía el padrón de socios de TODOS los gimnasios.

drop policy if exists "admins can read all profiles in their gym" on public.profiles;

create policy "staff can read profiles in their gym"
on public.profiles for select to authenticated
using (
  (select get_my_role()) = any (array['admin','trainer'])
  and gym_id = (select get_my_gym_id())
);