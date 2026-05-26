-- Admins can view all payments from their gym
CREATE POLICY "admins can view gym payments" ON payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND gym_id = payments.gym_id
        AND role = 'admin'
    )
  );

-- Members can view only their own payments
CREATE POLICY "members can view own payments" ON payments
  FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());
