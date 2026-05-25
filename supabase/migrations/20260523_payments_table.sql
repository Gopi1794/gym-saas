create type payment_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'refunded');

create table payments (
  id             uuid primary key default gen_random_uuid(),
  gym_id         uuid not null references gyms(id) on delete cascade,
  member_id      uuid not null references profiles(id) on delete cascade,
  amount         numeric(10, 2) not null check (amount > 0),
  status         payment_status not null default 'pending',
  mp_payment_id  text,
  created_at     timestamptz not null default now()
);

create index payments_gym_id_idx    on payments(gym_id);
create index payments_member_id_idx on payments(member_id);
create index payments_created_at_idx on payments(created_at desc);

alter table payments enable row level security;

-- Gym admins/owners can see all payments for their gym
create policy "gym_admin_select_payments" on payments
  for select using (
    gym_id in (
      select id from gyms where owner_id = auth.uid()
    )
    or
    gym_id in (
      select gym_id from profiles where id = auth.uid() and role in ('admin', 'trainer')
    )
  );

-- Members can see their own payments
create policy "member_select_own_payments" on payments
  for select using (member_id = auth.uid());

-- Only service role can insert/update (webhooks, server actions)
-- No insert/update policy for authenticated users → handled via service role client
