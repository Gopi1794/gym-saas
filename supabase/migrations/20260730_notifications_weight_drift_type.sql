-- supabase/migrations/20260730_notifications_weight_drift_type.sql
-- Habilita el tipo 'weight_drift': un socio actualiza su peso y eso deja
-- desactualizado el objetivo de su plan nutricional activo.
-- Parte de la lista vigente (20260523_notify_churn.sql agregó 'churn_alert'
-- sobre la original de 5 valores), no de la lista original.

alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
  'new_member',
  'check_in',
  'achievement',
  'plan_assigned',
  'membership_expiring',
  'churn_alert',
  'weight_drift'
));
