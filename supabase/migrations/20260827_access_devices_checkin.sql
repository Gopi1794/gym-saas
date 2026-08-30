-- Access devices and credentials for ESP32/NFC check-in.

alter table public.check_ins
  drop constraint if exists check_ins_method_check;

alter table public.check_ins
  add constraint check_ins_method_check
  check (method in ('qr', 'manual', 'device', 'nfc'));

create table if not exists public.access_devices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null,
  device_uid text not null unique,
  token_hash text not null,
  status text not null default 'active' check (status in ('active', 'disabled')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.member_access_credentials (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  credential_hash text not null,
  kind text not null default 'nfc' check (kind in ('nfc', 'serial_test')),
  label text,
  status text not null default 'active' check (status in ('active', 'disabled', 'lost')),
  created_at timestamptz not null default now()
);

create table if not exists public.access_events (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  device_id uuid references public.access_devices(id) on delete set null,
  member_id uuid references public.profiles(id) on delete set null,
  credential_hash text,
  result text not null check (result in ('accepted', 'rejected', 'expired', 'unknown_credential', 'disabled_device')),
  reason text,
  created_at timestamptz not null default now()
);

create unique index if not exists member_access_credentials_active_uidx
  on public.member_access_credentials(gym_id, credential_hash)
  where status = 'active';

create index if not exists access_devices_gym_id_idx on public.access_devices(gym_id);
create index if not exists member_access_credentials_gym_id_idx on public.member_access_credentials(gym_id);
create index if not exists member_access_credentials_member_id_idx on public.member_access_credentials(member_id);
create index if not exists access_events_gym_id_created_at_idx on public.access_events(gym_id, created_at desc);

alter table public.access_devices enable row level security;
alter table public.member_access_credentials enable row level security;
alter table public.access_events enable row level security;

drop policy if exists "admins manage access devices" on public.access_devices;
create policy "admins manage access devices" on public.access_devices
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = access_devices.gym_id
      and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = access_devices.gym_id
      and p.role = 'admin'
  ));

drop policy if exists "admins manage member access credentials" on public.member_access_credentials;
create policy "admins manage member access credentials" on public.member_access_credentials
  for all
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = member_access_credentials.gym_id
      and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = member_access_credentials.gym_id
      and p.role = 'admin'
  ));

drop policy if exists "admins read access events" on public.access_events;
create policy "admins read access events" on public.access_events
  for select
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.gym_id = access_events.gym_id
      and p.role = 'admin'
  ));

revoke all on public.access_devices from anon;
revoke all on public.member_access_credentials from anon;
revoke all on public.access_events from anon;

grant select, insert, update, delete on public.access_devices to authenticated;
grant select, insert, update, delete on public.member_access_credentials to authenticated;
grant select on public.access_events to authenticated;
