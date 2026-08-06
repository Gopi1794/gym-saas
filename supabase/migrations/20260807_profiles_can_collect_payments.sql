-- Permiso granular para que un trainer puntual pueda cobrar y renovar
-- membresías. Lo otorga el admin por trainer (nunca el propio trainer) —
-- ver 20260726_profiles_column_privileges.sql: authenticated solo tiene
-- UPDATE otorgado sobre una lista explícita de columnas de perfil personal.
-- Esta columna NO se agrega a esa lista, así que el único camino de
-- escritura es un server action admin-only con createAdminClient().
alter table profiles add column can_collect_payments boolean not null default false;
