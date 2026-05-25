-- Permite a admins registrar pagos en efectivo desde server actions
create policy "admin_insert_payments" on payments
  for insert with check (
    gym_id in (
      select gym_id from profiles
      where id = auth.uid() and role = 'admin'
    )
  );
