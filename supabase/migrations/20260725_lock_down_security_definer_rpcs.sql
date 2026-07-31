-- Estas funciones son SECURITY DEFINER: corren con los privilegios de quien las
-- creó e ignoran RLS. Se invocan solo desde el servidor con la service role key.
-- Postgres otorga EXECUTE a PUBLIC por defecto, lo que las dejaba expuestas como
-- endpoints RPC a cualquiera con la clave publishable.

revoke execute on function public.get_mp_token_for_checkout(uuid)
  from public, anon, authenticated;
grant execute on function public.get_mp_token_for_checkout(uuid)
  to service_role;

revoke execute on function public.extend_member_membership(uuid, uuid, text, numeric, text, integer)
  from public, anon, authenticated;
grant execute on function public.extend_member_membership(uuid, uuid, text, numeric, text, integer)
  to service_role;

revoke execute on function public.create_gym_for_owner(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_gym_for_owner(uuid, text)
  to service_role;