-- Sincroniza la base remota con el soporte de webhook secret de MercadoPago
-- y cierra grants peligrosos encontrados al auditar la DB antes de tocar el webhook.
--
-- Contexto:
-- - El codigo ya llama get_mp_webhook_secret_for_webhook(p_gym_id), pero la
--   base remota no tenia ni la columna mp_webhook_secret_vault_id ni las RPCs.
-- - La version historica 20260619_mp_webhook_secret.sql validaba contra
--   gyms.owner_id; eso quedo obsoleto por 20260525_fix_mp_token_auth.sql: la
--   fuente real de autorizacion del proyecto es profiles.gym_id + role='admin'.
-- - expire_stale_payment_checkouts() estaba ejecutable por PUBLIC/anon aunque
--   es SECURITY DEFINER. El cron no necesita ese grant.

alter table public.gyms
  add column if not exists mp_webhook_secret_vault_id uuid;

create or replace function public.set_gym_mp_webhook_secret(p_gym_id uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret_id uuid;
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and gym_id = p_gym_id
      and role = 'admin'
  ) then
    raise exception 'Not authorized';
  end if;

  select mp_webhook_secret_vault_id
    into v_secret_id
  from public.gyms
  where id = p_gym_id;

  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_secret,
      'mp_webhook_secret_' || p_gym_id::text,
      'MercadoPago webhook secret'
    );

    update public.gyms
    set mp_webhook_secret_vault_id = v_secret_id
    where id = p_gym_id;
  else
    perform vault.update_secret(v_secret_id, p_secret);
  end if;
end;
$$;

create or replace function public.get_gym_mp_webhook_secret_configured(p_gym_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and gym_id = p_gym_id
      and role = 'admin'
  ) then
    raise exception 'Not authorized';
  end if;

  return exists (
    select 1
    from public.gyms
    where id = p_gym_id
      and mp_webhook_secret_vault_id is not null
  );
end;
$$;

create or replace function public.get_mp_webhook_secret_for_webhook(p_gym_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret_id uuid;
  v_secret text;
begin
  select mp_webhook_secret_vault_id
    into v_secret_id
  from public.gyms
  where id = p_gym_id;

  if v_secret_id is null then
    return null;
  end if;

  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where id = v_secret_id;

  return v_secret;
end;
$$;

-- Admin panel RPCs: callable only by authenticated users; body enforces admin+gym.
revoke execute on function public.set_gym_mp_webhook_secret(uuid, text) from public, anon;
grant execute on function public.set_gym_mp_webhook_secret(uuid, text) to authenticated;

revoke execute on function public.get_gym_mp_webhook_secret_configured(uuid) from public, anon;
grant execute on function public.get_gym_mp_webhook_secret_configured(uuid) to authenticated;

-- Webhook internal RPC: server-only, called with service role.
revoke execute on function public.get_mp_webhook_secret_for_webhook(uuid) from public, anon, authenticated;
grant execute on function public.get_mp_webhook_secret_for_webhook(uuid) to service_role;

-- Cron function: SECURITY DEFINER. It must not be callable by browser roles.
revoke execute on function public.expire_stale_payment_checkouts() from public, anon, authenticated;
grant execute on function public.expire_stale_payment_checkouts() to service_role;
