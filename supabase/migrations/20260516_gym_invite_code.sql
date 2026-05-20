-- Add invite_code to gyms
alter table gyms
  add column if not exists invite_code text unique;

-- Generate a code for existing rows
update gyms
  set invite_code = substring(md5(id::text), 1, 8)
  where invite_code is null;

-- Make it non-null with a default for future rows
alter table gyms
  alter column invite_code set default substring(md5(gen_random_uuid()::text), 1, 8),
  alter column invite_code set not null;

-- Update handle_new_user to resolve invite code → gym_id at signup time
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_gym_id uuid;
begin
  if new.raw_user_meta_data ->> 'gym_invite_code' is not null then
    select id into v_gym_id
    from public.gyms
    where invite_code = new.raw_user_meta_data ->> 'gym_invite_code';
  end if;

  insert into public.profiles (id, full_name, avatar_url, gym_id)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    v_gym_id
  );
  return new;
end;
$$;
