-- Add vault secret reference to gyms
alter table gyms
  add column if not exists mp_vault_secret_id uuid;

-- Set or update the MercadoPago access token for a gym (stored encrypted in Vault)
create or replace function set_gym_mp_token(p_gym_id uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_secret_id uuid;
begin
  if not exists (
    select 1 from gyms where id = p_gym_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  select mp_vault_secret_id into v_secret_id from gyms where id = p_gym_id;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_token,
      'mp_token_' || p_gym_id::text,
      'MercadoPago access token'
    );
    update gyms set mp_vault_secret_id = v_secret_id where id = p_gym_id;
  else
    perform vault.update_secret(v_secret_id, p_token);
  end if;
end;
$$;

-- Get the decrypted MercadoPago access token for a gym
create or replace function get_gym_mp_token(p_gym_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_secret_id uuid;
begin
  if not exists (
    select 1 from gyms where id = p_gym_id and owner_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  select mp_vault_secret_id into v_secret_id from gyms where id = p_gym_id;
  if v_secret_id is null then return null; end if;

  select decrypted_secret into v_token
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_token;
end;
$$;
