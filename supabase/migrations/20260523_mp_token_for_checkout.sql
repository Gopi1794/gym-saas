-- Server-side only function to retrieve the mp_access_token for a gym.
-- No auth check — intended to be called exclusively from Next.js API routes
-- using the service role key, never from the browser.
create or replace function get_mp_token_for_checkout(p_gym_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_secret_id uuid;
  v_token     text;
begin
  select mp_vault_secret_id into v_secret_id from gyms where id = p_gym_id;
  if v_secret_id is null then return null; end if;
  select decrypted_secret into v_token from vault.decrypted_secrets where id = v_secret_id;
  return v_token;
end;
$$;
