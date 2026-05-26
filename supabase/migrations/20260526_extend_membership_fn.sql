create or replace function extend_member_membership(
  p_member_id uuid,
  p_gym_id uuid,
  p_payment_id text,
  p_amount numeric,
  p_membership_type text,
  p_duration_days int
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_current_expires timestamptz;
  v_base timestamptz;
  v_new_expires timestamptz;
begin
  select membership_expires_at into v_current_expires
  from profiles where id = p_member_id;

  v_base := case
    when v_current_expires is null or v_current_expires < now() then now()
    else v_current_expires
  end;

  v_new_expires := v_base + (p_duration_days || ' days')::interval;

  update profiles
  set
    membership_expires_at = v_new_expires,
    membership_type = p_membership_type
  where id = p_member_id;

  insert into payments (gym_id, member_id, amount, status, mp_payment_id)
  values (p_gym_id, p_member_id, p_amount, 'approved', p_payment_id)
  on conflict (mp_payment_id) do nothing;
end;
$$;
