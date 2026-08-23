-- Product commerce orders, reservations, stock movements, and member-safe promotions.
-- Additive foundation for product-commerce-growth PR 1.

create table if not exists product_orders (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete cascade,
  member_id uuid references profiles(id) on delete set null,
  status text not null check (status in ('reserved', 'paid', 'cancelled', 'expired')),
  order_type text not null check (order_type in ('sale', 'reservation')),
  subtotal_amount numeric(10,2) not null default 0 check (subtotal_amount >= 0),
  total_amount numeric(10,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(10,2) check (paid_amount is null or paid_amount >= 0),
  payment_method text check (payment_method is null or payment_method in ('cash', 'mercadopago', 'transfer', 'card', 'other')),
  payment_reference text,
  reserved_until timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid not null references profiles(id) on delete set null,
  paid_by uuid references profiles(id) on delete set null,
  cancelled_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'reserved') = (reserved_until is not null and paid_at is null and payment_method is null)),
  check ((status <> 'paid') or (payment_method is not null and paid_at is not null and paid_amount is not null))
);

create table if not exists product_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references product_orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  variant_id uuid not null references product_variants(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  unit_cost numeric(10,2) not null check (unit_cost >= 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  line_margin numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists product_stock_movements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete cascade,
  order_id uuid references product_orders(id) on delete set null,
  order_item_id uuid references product_order_items(id) on delete set null,
  product_id uuid not null references products(id) on delete restrict,
  variant_id uuid not null references product_variants(id) on delete restrict,
  movement_type text not null check (movement_type in ('sale', 'reservation', 'release', 'cancellation')),
  quantity_delta integer not null check (quantity_delta <> 0),
  stock_after integer not null check (stock_after >= 0),
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists product_promotions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references gyms(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete set null,
  title text not null,
  description text,
  image_url text,
  public_price numeric(10,2) not null check (public_price >= 0),
  cta_label text,
  is_active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists product_orders_gym_status_created_idx on product_orders(gym_id, status, created_at desc);
create index if not exists product_orders_gym_member_idx on product_orders(gym_id, member_id) where member_id is not null;
create index if not exists product_order_items_order_idx on product_order_items(order_id);
create index if not exists product_order_items_variant_idx on product_order_items(variant_id);
create index if not exists product_stock_movements_gym_variant_created_idx on product_stock_movements(gym_id, variant_id, created_at desc);
create index if not exists product_promotions_visible_idx on product_promotions(gym_id, is_active, starts_at, ends_at, sort_order);

alter table product_orders enable row level security;
alter table product_order_items enable row level security;
alter table product_stock_movements enable row level security;
alter table product_promotions enable row level security;

create policy "admin lee ordenes de su gym" on product_orders
  for select to authenticated
  using (exists (select 1 from profiles where id = (select auth.uid()) and gym_id = product_orders.gym_id and role = 'admin'));

create policy "admin lee items de ordenes de su gym" on product_order_items
  for select to authenticated
  using (exists (
    select 1 from product_orders o
    join profiles pr on pr.gym_id = o.gym_id
    where o.id = product_order_items.order_id and pr.id = (select auth.uid()) and pr.role = 'admin'
  ));

create policy "admin lee movimientos de stock de su gym" on product_stock_movements
  for select to authenticated
  using (exists (select 1 from profiles where id = (select auth.uid()) and gym_id = product_stock_movements.gym_id and role = 'admin'));

create policy "staff gestiona promociones de su gym" on product_promotions
  for all to authenticated
  using (exists (select 1 from profiles where id = (select auth.uid()) and gym_id = product_promotions.gym_id and role = 'admin'))
  with check (exists (select 1 from profiles where id = (select auth.uid()) and gym_id = product_promotions.gym_id and role = 'admin'));

create policy "socios leen promociones activas de su gym" on product_promotions
  for select to authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and exists (
      select 1 from profiles
      where id = (select auth.uid())
        and gym_id = product_promotions.gym_id
        and role in ('member', 'admin', 'trainer')
    )
  );

create or replace function create_product_order(
  p_gym_id uuid,
  p_member_id uuid,
  p_items jsonb,
  p_created_by uuid,
  p_order_type text default 'sale',
  p_payment_method text default null,
  p_payment_reference text default null,
  p_reservation_minutes integer default 30
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_order_item_id uuid;
  v_item jsonb;
  v_variant product_variants%rowtype;
  v_product products%rowtype;
  v_quantity integer;
  v_unit_price numeric(10,2);
  v_unit_cost numeric(10,2);
  v_line_total numeric(10,2);
  v_line_margin numeric(10,2);
  v_total numeric(10,2) := 0;
  v_stock_after integer;
begin
  if p_gym_id is null or p_created_by is null then
    raise exception 'Gym y usuario son obligatorios';
  end if;

  if p_order_type not in ('sale', 'reservation') then
    raise exception 'Tipo de orden invalido';
  end if;

  if p_order_type = 'sale' and p_payment_method is null then
    raise exception 'El metodo de pago es obligatorio para ventas pagas';
  end if;

  if p_payment_method is not null and p_payment_method not in ('cash', 'mercadopago', 'transfer', 'card', 'other') then
    raise exception 'Metodo de pago invalido';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden debe incluir al menos un item';
  end if;

  if not exists (select 1 from profiles where id = p_created_by and gym_id = p_gym_id and role in ('admin', 'trainer')) then
    raise exception 'Usuario sin permiso para crear ordenes de productos';
  end if;

  if p_member_id is not null and not exists (select 1 from profiles where id = p_member_id and gym_id = p_gym_id) then
    raise exception 'El socio no pertenece a este gym';
  end if;

  insert into product_orders (
    gym_id, member_id, status, order_type, subtotal_amount, total_amount,
    paid_amount, payment_method, payment_reference, reserved_until, paid_at, created_by, paid_by
  ) values (
    p_gym_id,
    p_member_id,
    case when p_order_type = 'reservation' then 'reserved' else 'paid' end,
    p_order_type,
    0,
    0,
    case when p_order_type = 'sale' then 0 else null end,
    case when p_order_type = 'sale' then p_payment_method else null end,
    case when p_order_type = 'sale' then p_payment_reference else null end,
    case when p_order_type = 'reservation' then now() + make_interval(mins => greatest(coalesce(p_reservation_minutes, 30), 1)) else null end,
    case when p_order_type = 'sale' then now() else null end,
    p_created_by,
    case when p_order_type = 'sale' then p_created_by else null end
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_quantity := nullif(v_item->>'quantity', '')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La cantidad debe ser mayor a cero';
    end if;

    select * into v_variant from product_variants where id = (v_item->>'variant_id')::uuid and is_active = true;
    if not found then
      raise exception 'Variante no encontrada';
    end if;

    select * into v_product from products where id = v_variant.product_id and is_active = true;
    if not found or v_product.gym_id is distinct from p_gym_id then
      raise exception 'La variante no pertenece a este gym';
    end if;

    v_unit_price := coalesce(v_variant.price, v_product.base_price);
    v_unit_cost := coalesce(v_variant.cost_price, v_product.base_cost);
    v_line_total := round(v_unit_price * v_quantity, 2);
    v_line_margin := round((v_unit_price - v_unit_cost) * v_quantity, 2);

    update product_variants
    set stock = stock - v_quantity
    where id = v_variant.id and stock >= v_quantity
    returning stock into v_stock_after;

    if not found then
      raise exception 'Stock insuficiente';
    end if;

    insert into product_order_items (
      order_id, product_id, variant_id, quantity, unit_price, unit_cost, line_total, line_margin
    ) values (
      v_order_id, v_product.id, v_variant.id, v_quantity, v_unit_price, v_unit_cost, v_line_total, v_line_margin
    ) returning id into v_order_item_id;

    insert into product_stock_movements (
      gym_id, order_id, order_item_id, product_id, variant_id, movement_type, quantity_delta, stock_after, reason, created_by
    ) values (
      p_gym_id, v_order_id, v_order_item_id, v_product.id, v_variant.id,
      case when p_order_type = 'reservation' then 'reservation' else 'sale' end,
      -v_quantity, v_stock_after,
      case when p_order_type = 'reservation' then 'product reservation' else 'product sale' end,
      p_created_by
    );

    v_total := v_total + v_line_total;
  end loop;

  update product_orders
  set subtotal_amount = v_total,
      total_amount = v_total,
      paid_amount = case when p_order_type = 'sale' then v_total else null end,
      updated_at = now()
  where id = v_order_id;

  return v_order_id;
end;
$$;

create or replace function mark_product_order_paid(
  p_order_id uuid,
  p_gym_id uuid,
  p_paid_by uuid,
  p_payment_method text,
  p_payment_reference text default null,
  p_paid_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order product_orders%rowtype;
  v_paid_amount numeric(10,2);
begin
  if p_payment_method is null or p_payment_method not in ('cash', 'mercadopago', 'transfer', 'card', 'other') then
    raise exception 'Metodo de pago invalido';
  end if;

  select * into v_order from product_orders where id = p_order_id for update;
  if not found or v_order.gym_id is distinct from p_gym_id then
    raise exception 'Orden no encontrada';
  end if;

  if v_order.status <> 'reserved' then
    raise exception 'Solo una reserva vigente puede marcarse como paga';
  end if;

  if v_order.reserved_until <= now() then
    raise exception 'La reserva expiro';
  end if;

  if not exists (select 1 from profiles where id = p_paid_by and gym_id = p_gym_id and role in ('admin', 'trainer')) then
    raise exception 'Usuario sin permiso para cobrar productos';
  end if;

  v_paid_amount := coalesce(p_paid_amount, v_order.total_amount);
  if v_paid_amount <> v_order.total_amount then
    raise exception 'El importe pagado debe coincidir con el total de la orden';
  end if;

  update product_orders
  set status = 'paid',
      paid_amount = v_paid_amount,
      payment_method = p_payment_method,
      payment_reference = p_payment_reference,
      paid_at = now(),
      paid_by = p_paid_by,
      reserved_until = null,
      updated_at = now()
  where id = p_order_id;

  return p_order_id;
end;
$$;

create or replace function cancel_product_order(
  p_order_id uuid,
  p_gym_id uuid,
  p_cancelled_by uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order product_orders%rowtype;
  v_item product_order_items%rowtype;
  v_stock_after integer;
begin
  select * into v_order from product_orders where id = p_order_id for update;
  if not found or v_order.gym_id is distinct from p_gym_id then
    raise exception 'Orden no encontrada';
  end if;

  if v_order.status not in ('reserved', 'paid') then
    raise exception 'La orden no puede cancelarse';
  end if;

  if not exists (select 1 from profiles where id = p_cancelled_by and gym_id = p_gym_id and role in ('admin', 'trainer')) then
    raise exception 'Usuario sin permiso para cancelar productos';
  end if;

  for v_item in select * from product_order_items where order_id = p_order_id loop
    update product_variants
    set stock = stock + v_item.quantity
    where id = v_item.variant_id
    returning stock into v_stock_after;

    insert into product_stock_movements (
      gym_id, order_id, order_item_id, product_id, variant_id, movement_type, quantity_delta, stock_after, reason, created_by
    ) values (
      p_gym_id, p_order_id, v_item.id, v_item.product_id, v_item.variant_id,
      'cancellation', v_item.quantity, v_stock_after, coalesce(p_reason, 'product order cancellation'), p_cancelled_by
    );
  end loop;

  update product_orders
  set status = 'cancelled', cancelled_at = now(), cancelled_by = p_cancelled_by, updated_at = now()
  where id = p_order_id;

  return p_order_id;
end;
$$;

create or replace function release_expired_product_reservations(p_gym_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order product_orders%rowtype;
  v_item product_order_items%rowtype;
  v_stock_after integer;
  v_released integer := 0;
begin
  if p_gym_id is null then
    raise exception 'Gym obligatorio para liberar reservas expiradas';
  end if;

  for v_order in
    select * from product_orders
    where status = 'reserved'
      and reserved_until <= now()
      and gym_id = p_gym_id
    for update skip locked
  loop
    for v_item in select * from product_order_items where order_id = v_order.id loop
      update product_variants
      set stock = stock + v_item.quantity
      where id = v_item.variant_id
      returning stock into v_stock_after;

      insert into product_stock_movements (
        gym_id, order_id, order_item_id, product_id, variant_id, movement_type, quantity_delta, stock_after, reason, created_by
      ) values (
        v_order.gym_id, v_order.id, v_item.id, v_item.product_id, v_item.variant_id,
        'release', v_item.quantity, v_stock_after, 'expired product reservation', null
      );
    end loop;

    update product_orders
    set status = 'expired', reserved_until = null, updated_at = now()
    where id = v_order.id;

    v_released := v_released + 1;
  end loop;

  return v_released;
end;
$$;

revoke all on function create_product_order(uuid, uuid, jsonb, uuid, text, text, text, integer) from public, anon, authenticated;
revoke all on function mark_product_order_paid(uuid, uuid, uuid, text, text, numeric) from public, anon, authenticated;
revoke all on function cancel_product_order(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function release_expired_product_reservations(uuid) from public, anon, authenticated;

grant execute on function create_product_order(uuid, uuid, jsonb, uuid, text, text, text, integer) to service_role;
grant execute on function mark_product_order_paid(uuid, uuid, uuid, text, text, numeric) to service_role;
grant execute on function cancel_product_order(uuid, uuid, uuid, text) to service_role;
grant execute on function release_expired_product_reservations(uuid) to service_role;
