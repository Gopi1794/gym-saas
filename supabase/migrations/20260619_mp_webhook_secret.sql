-- Almacena el webhook secret de MP por gym en Vault (igual que el access token)

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS mp_webhook_secret_vault_id uuid;

-- El owner guarda su webhook secret desde el panel de admin
CREATE OR REPLACE FUNCTION set_gym_mp_webhook_secret(p_gym_id uuid, p_secret text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gyms WHERE id = p_gym_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT mp_webhook_secret_vault_id INTO v_secret_id FROM gyms WHERE id = p_gym_id;

  IF v_secret_id IS NULL THEN
    v_secret_id := vault.create_secret(
      p_secret,
      'mp_webhook_secret_' || p_gym_id::text,
      'MercadoPago webhook secret'
    );
    UPDATE gyms SET mp_webhook_secret_vault_id = v_secret_id WHERE id = p_gym_id;
  ELSE
    PERFORM vault.update_secret(v_secret_id, p_secret);
  END IF;
END;
$$;

-- Solo para el webhook handler (service role) — sin auth check
CREATE OR REPLACE FUNCTION get_mp_webhook_secret_for_webhook(p_gym_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_secret_id uuid;
  v_secret    text;
BEGIN
  SELECT mp_webhook_secret_vault_id INTO v_secret_id FROM gyms WHERE id = p_gym_id;
  IF v_secret_id IS NULL THEN RETURN NULL; END IF;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE id = v_secret_id;
  RETURN v_secret;
END;
$$;

-- Para el panel de admin: saber si ya está configurado (sin exponer el valor)
CREATE OR REPLACE FUNCTION get_gym_mp_webhook_secret_configured(p_gym_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gyms WHERE id = p_gym_id AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM gyms WHERE id = p_gym_id AND mp_webhook_secret_vault_id IS NOT NULL
  );
END;
$$;
