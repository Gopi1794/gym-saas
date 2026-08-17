-- Catálogo de productos físicos que el gym vende en el mostrador (agua,
-- suplementos, ropa) — sub-proyecto 1 de venta de productos. Ver spec:
-- docs/superpowers/specs/2026-08-15-product-sales-catalog-design.md

create table products (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references gyms(id) on delete cascade,
  name        text not null,
  description text,
  category    text not null check (category in ('bebidas', 'suplementos', 'indumentaria', 'accesorios', 'otro')),
  image_url   text,
  base_price  numeric(10,2) not null check (base_price >= 0),
  base_cost   numeric(10,2) not null check (base_cost >= 0),
  is_active   boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  name        text not null, -- "Única", "500ml", "Talle M"
  sku         text,
  price       numeric(10,2) check (price is null or price >= 0),      -- null = usa products.base_price
  cost_price  numeric(10,2) check (cost_price is null or cost_price >= 0), -- null = usa products.base_cost
  stock       integer not null default 0 check (stock >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table product_sales (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references gyms(id) on delete cascade,
  variant_id    uuid not null references product_variants(id) on delete restrict,
  member_id     uuid references profiles(id) on delete set null, -- opcional
  quantity      integer not null check (quantity > 0),
  unit_price    numeric(10,2) not null, -- congelado al momento de vender
  unit_cost     numeric(10,2) not null, -- congelado al momento de vender
  total_amount  numeric(10,2) not null,
  method        text not null check (method in ('cash')), -- 'mercadopago' se suma en sub-proyecto 2
  recorded_by   uuid not null references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index product_variants_product_id_idx on product_variants(product_id);
create index product_sales_gym_id_created_at_idx on product_sales(gym_id, created_at desc);
create index product_sales_variant_id_idx on product_sales(variant_id);

alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_sales enable row level security;

create policy "staff lee catalogo de su gym" on products
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where id = (select auth.uid())
        and gym_id = products.gym_id
        and role in ('admin', 'trainer')
    )
  );

create policy "admin escribe catalogo de su gym" on products
  for all to authenticated
  using (
    exists (
      select 1 from profiles
      where id = (select auth.uid())
        and gym_id = products.gym_id
        and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = (select auth.uid())
        and gym_id = products.gym_id
        and role = 'admin'
    )
  );

create policy "staff lee variantes de su gym" on product_variants
  for select to authenticated
  using (
    exists (
      select 1 from products p
      join profiles pr on pr.gym_id = p.gym_id
      where p.id = product_variants.product_id
        and pr.id = (select auth.uid())
        and pr.role in ('admin', 'trainer')
    )
  );

create policy "admin escribe variantes de su gym" on product_variants
  for all to authenticated
  using (
    exists (
      select 1 from products p
      join profiles pr on pr.gym_id = p.gym_id
      where p.id = product_variants.product_id
        and pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from products p
      join profiles pr on pr.gym_id = p.gym_id
      where p.id = product_variants.product_id
        and pr.id = (select auth.uid())
        and pr.role = 'admin'
    )
  );

-- Solo admin lee ventas (mismo alcance que la pestaña "Ventas", admin-only
-- igual que /reports). Nunca se escribe directo desde el cliente — todo
-- insert pasa por record_product_sale (Task 2).
create policy "admin lee ventas de su gym" on product_sales
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where id = (select auth.uid())
        and gym_id = product_sales.gym_id
        and role = 'admin'
    )
  );
