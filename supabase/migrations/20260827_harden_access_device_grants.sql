-- Harden grants for ESP32/NFC access tables.
-- Keep browser/admin operations behind RLS and prevent broad table-level privileges.

revoke all on public.access_devices from anon, authenticated;
revoke all on public.member_access_credentials from anon, authenticated;
revoke all on public.access_events from anon, authenticated;

grant select, insert, update, delete on public.access_devices to authenticated;
grant select, insert, update, delete on public.member_access_credentials to authenticated;
grant select on public.access_events to authenticated;
