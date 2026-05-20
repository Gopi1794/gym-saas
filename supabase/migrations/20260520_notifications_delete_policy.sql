-- Allow users to delete their own notifications (dismiss / clear all)
create policy "users delete own notifications"
  on notifications for delete
  using (user_id = auth.uid());
