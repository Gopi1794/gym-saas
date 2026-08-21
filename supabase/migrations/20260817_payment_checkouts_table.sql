-- Trackea cada preferencia de checkout de MercadoPago creada, para poder
-- detectar abandono real (el cliente nunca llega a intentar pagar — MP no
-- manda ningún webhook en ese caso, no hay nada que escuchar). Se inserta
-- al crear la preferencia, se marca 'resolved' en cuanto llega cualquier
-- webhook real para esa referencia, y un cron (ver siguiente migración) la
-- marca 'expired' si sigue 'pending' pasado su vencimiento.
--
-- No reutiliza `payments`: esa tabla representa transacciones reales, no
-- intentos — mezclar los dos conceptos ensuciaría los reportes de ingresos.
--
-- `kind` ya distingue 'membership' de 'product' aunque este sub-proyecto
-- solo use 'membership' — evita una segunda migración cuando se sume el
-- cobro de productos por MercadoPago (sub-proyecto 2b).
create table payment_checkouts (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references gyms(id) on delete cascade,
  external_reference  text not null unique,
  kind                text not null check (kind in ('membership', 'product')),
  status              text not null default 'pending' check (status in ('pending', 'resolved', 'expired')),
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null
);

create index payment_checkouts_pending_expiry_idx
  on payment_checkouts(expires_at)
  where status = 'pending';

alter table payment_checkouts enable row level security;

create policy "admin lee checkouts de su gym" on payment_checkouts
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where id = (select auth.uid())
        and gym_id = payment_checkouts.gym_id
        and role = 'admin'
    )
  );

-- Sin policy de insert/update para authenticated — se escribe solo desde
-- el cliente admin (checkout route, webhook, cron), igual que payments.
