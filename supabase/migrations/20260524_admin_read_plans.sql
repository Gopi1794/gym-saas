-- Allow gym admins to read workout plans created by trainers in their gym
-- (needed for StaffLog member counts)
-- Note: workout_plans has no gym_id column — scope via created_by → profiles.gym_id
drop policy if exists "admins can read plans in their gym" on workout_plans;
create policy "admins can read plans in their gym"
  on workout_plans for select
  using (
    exists (
      select 1
      from profiles admin_p
      join profiles trainer_p on trainer_p.gym_id = admin_p.gym_id
      where admin_p.id = auth.uid()
        and admin_p.role = 'admin'
        and trainer_p.id = workout_plans.created_by
    )
  );
    