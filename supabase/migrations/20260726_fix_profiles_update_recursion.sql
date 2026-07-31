-- supabase/migrations/20260726_fix_profiles_update_recursion.sql
-- La policy consultaba profiles dentro de una policy de profiles → recursión
-- infinita (42P17). Se reescribe con los helpers SECURITY DEFINER que ya usa
-- el resto del esquema.

drop policy if exists "staff can update profiles in their gym" on public.profiles;

create policy "staff can update profiles in their gym"
on public.profiles for update to authenticated
using (
  (select get_my_role()) = any (array['admin','trainer'])
  and gym_id = (select get_my_gym_id())
)
with check (
  (select get_my_role()) = any (array['admin','trainer'])
  and gym_id = (select get_my_gym_id())
);