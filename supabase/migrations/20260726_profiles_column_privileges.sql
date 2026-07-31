-- supabase/migrations/20260726_profiles_column_privileges.sql
-- Las policies de UPDATE de profiles solo validaban que la fila fuera tuya,
-- no qué columnas cambiabas: un socio podía escribirse role='admin'.
-- Los privilegios por columna lo bloquean a nivel Postgres, independientemente
-- de RLS. service_role no se ve afectado: los webhooks y acciones de servidor
-- siguen pudiendo escribir todo.

revoke update on public.profiles from authenticated;

grant update (
  full_name, avatar_url, gender, date_of_birth, phone,
  weight_kg, height_cm, goal, medical_conditions, training_frequency,
  emergency_name, emergency_phone, onboarding_seen, notification_hour
) on public.profiles to authenticated;