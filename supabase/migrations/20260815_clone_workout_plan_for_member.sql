-- Clona una plantilla (workout_plans.is_template = true) completa --
-- dias, ejercicios y set_configs -- en un plan nuevo asignado a un socio.
-- Antes de esto no existia forma de reutilizar una plantilla: el trainer
-- tenia que recrear manualmente cada dia/ejercicio para cada socio.
--
-- SECURITY INVOKER a proposito (no DEFINER): las RLS de workout_plans,
-- workout_plan_days, workout_plan_exercises y workout_plan_set_configs ya
-- permiten a admin/trainer de un gym leer templates e insertar filas en
-- las 4 tablas (confirmado en 20260812_consolidate_multiple_permissive_
-- policies.sql) -- no hace falta bypasear RLS, el control de acceso ya lo
-- hacen las policies existentes en cada INSERT/SELECT de esta funcion.
create or replace function public.clone_workout_plan_for_member(
  p_template_id uuid,
  p_member_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_template          workout_plans%rowtype;
  v_new_plan_id        uuid;
  v_day                workout_plan_days%rowtype;
  v_new_day_id         uuid;
  v_exercise           workout_plan_exercises%rowtype;
  v_new_exercise_id    uuid;
begin
  select * into v_template
  from workout_plans
  where id = p_template_id and is_template = true;

  if not found then
    raise exception 'Plantilla no encontrada';
  end if;

  insert into workout_plans (name, description, is_template, created_by, assigned_to, level, gym_id)
  values (v_template.name, v_template.description, false, auth.uid(), p_member_id, v_template.level, v_template.gym_id)
  returning id into v_new_plan_id;

  for v_day in select * from workout_plan_days where plan_id = p_template_id loop
    insert into workout_plan_days (plan_id, day_of_week, name)
    values (v_new_plan_id, v_day.day_of_week, v_day.name)
    returning id into v_new_day_id;

    for v_exercise in select * from workout_plan_exercises where day_id = v_day.id loop
      insert into workout_plan_exercises (
        day_id, exercise_id, sets, reps, rest_seconds, order_index,
        notes, duration_seconds, reps_max, phase
      )
      values (
        v_new_day_id, v_exercise.exercise_id, v_exercise.sets, v_exercise.reps,
        v_exercise.rest_seconds, v_exercise.order_index, v_exercise.notes,
        v_exercise.duration_seconds, v_exercise.reps_max, v_exercise.phase
      )
      returning id into v_new_exercise_id;

      insert into workout_plan_set_configs (exercise_id, set_number, reps, reps_max, percent_1rm, duration_seconds, notes)
      select v_new_exercise_id, set_number, reps, reps_max, percent_1rm, duration_seconds, notes
      from workout_plan_set_configs
      where exercise_id = v_exercise.id;
    end loop;
  end loop;

  return v_new_plan_id;
end;
$$;

revoke execute on function public.clone_workout_plan_for_member(uuid, uuid) from public, anon;
grant execute on function public.clone_workout_plan_for_member(uuid, uuid) to authenticated;
