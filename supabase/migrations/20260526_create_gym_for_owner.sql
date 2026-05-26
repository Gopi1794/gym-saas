create or replace function create_gym_for_owner(p_user_id uuid, p_gym_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_gym_id uuid;
begin
  insert into gyms (name)
  values (p_gym_name)
  returning id into v_gym_id;

  update profiles
  set gym_id = v_gym_id,
      role = 'admin'
  where id = p_user_id;

  return v_gym_id;
end;
$$;
