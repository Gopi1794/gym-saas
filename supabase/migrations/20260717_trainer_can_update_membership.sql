-- Trainers cobran pagos en efectivo en el mostrador y necesitan poder
-- extender la membresía del socio en el mismo paso. Hasta ahora la policy
-- de UPDATE en profiles solo permitía admin, lo que generaba pagos
-- registrados sin que la membresía se actualizara (RLS bloqueaba el UPDATE
-- en silencio, sin error).

drop policy if exists "admins can update profiles in their gym" on profiles;

create policy "staff can update profiles in their gym"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'trainer')
        and p.gym_id = profiles.gym_id
    )
  );
