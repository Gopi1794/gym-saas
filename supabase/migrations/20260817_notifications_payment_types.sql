-- Habilita los tipos de notificación que usa el manejo de estados del
-- webhook de MercadoPago. 'payment_received' ya se usaba en el código
-- (app/api/mp/webhook/route.ts) pero nunca estuvo en esta lista — cada
-- insert fallaba en silencio, atrapado por un catch que solo lo logueaba.
-- Confirmado contra la base en vivo: 9 pagos aprobados, 0 notificaciones
-- de payment_received registradas nunca. Se corrige de paso.
alter table notifications drop constraint if exists notifications_type_check;

alter table notifications add constraint notifications_type_check check (type in (
  'new_member', 'check_in', 'achievement', 'plan_assigned',
  'membership_expiring', 'churn_alert', 'weight_drift', 'calorie_alert',
  'nutrition_duration_ready', 'payment_received', 'payment_failed',
  'payment_checkout_expired'
));
