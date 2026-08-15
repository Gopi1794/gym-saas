# Catálogo de productos, stock y venta en efectivo — sub-proyecto 1 de venta de productos

**Fecha:** 2026-08-15
**Estado:** Aprobado

## Contexto

Los gimnasios venden productos físicos en el mostrador — agua, proteína, creatina, ropa deportiva — y hoy Voltia no tiene absolutamente nada para eso: sin tabla de productos, sin stock, sin punto de venta (confirmado revisando el schema completo, `supabase/bd_full.sql`).

El feature completo se decompuso en 3 sub-proyectos independientes y secuenciales:

1. **Catálogo + stock + venta en efectivo** (este spec).
2. Cobro de productos vía MercadoPago — generaliza el `external_reference` del webhook (`app/api/mp/webhook/route.ts`), hoy hardcodeado a membresías.
3. Reportes de ventas — totales/métricas en `/reports`, sobre los datos que este sub-proyecto ya deja grabados.

Este documento cubre **solo el sub-proyecto 1**. Tiene que ser útil por sí solo: un gym puede cargar su catálogo, controlar stock y cobrar en efectivo sin que existan los otros dos.

## Decisiones de arquitectura

- **Toda venta pasa por una variante, nunca por el producto pelado.** Incluso un producto simple como "Agua" tiene una variante única (ej. "500ml"). Esto evita que `product_sales` tenga que contemplar dos casos (con/sin variante) — siempre referencia `variant_id`.
- **No hay borrado físico de productos ni variantes**, solo `is_active`. Si se pudiera borrar una variante con ventas asociadas, se perdería o se rompería el historial (`product_sales.variant_id` quedaría huérfano o el `ON DELETE` forzaría una decisión mala). La UI de este sub-proyecto no ofrece un botón "Eliminar", solo "Desactivar".
- **Precio y costo se resuelven variante → producto**, no solo precio: `product_variants.price`/`cost_price` son nullable, y si son `null` se usa `products.base_price`/`base_cost`. Sirve para productos con variantes de igual precio (ej. una remera talle S/M/L al mismo valor) sin repetir el dato en cada fila.
- **Cada venta congela precio Y costo unitario** (`product_sales.unit_price`, `unit_cost`), no solo el precio. Si el costo del producto cambia más adelante (el proveedor sube el precio), las ventas ya hechas tienen que seguir mostrando la ganancia real del momento en que se vendieron — no se puede recalcular la ganancia histórica contra un costo nuevo. No se maneja costeo por lote/FIFO: `cost_price` es siempre "el costo más reciente conocido", y se actualiza opcionalmente al reponer stock.
- **El stock nunca se escribe con un UPDATE directo desde el cliente** — solo a través de dos funciones de Postgres, cada una con el nivel de privilegio que su caso realmente necesita (mismo criterio ya usado en el proyecto para `clone_workout_plan_for_member` vs. `extend_member_membership` — no un patrón único aplicado a ciegas):
  - **`restock_product_variant`** (reponer stock: admin-only) — `SECURITY INVOKER`. Las RLS de `product_variants` ya limitan el UPDATE a admin del mismo gym, así que la función no necesita bypasear nada: si la llama alguien sin permiso, el UPDATE interno afecta 0 filas y la función lo detecta y rechaza. Se necesita como función (no como `.update()` directo del cliente JS) porque tiene que sumar sobre el valor actual (`stock = stock + N`), no pisarlo con un valor absoluto.
  - **`record_product_sale`** (vender: admin o trainer con `can_collect_payments`) — `SECURITY DEFINER`, igual que `extend_member_membership`. Acá sí hace falta bypasear RLS: un trainer no tiene (ni debe tener) permiso de UPDATE general sobre `product_variants` — si lo tuviera, podría editar precio y nombre, no solo vender. La función bypasea RLS para esta única operación puntual (descontar stock + insertar la venta), atómicamente, evitando condición de carrera si dos personas venden la última unidad al mismo tiempo (`UPDATE ... WHERE stock >= cantidad`, que toma el lock de fila de Postgres).
- **`record_product_sale` sigue exactamente el patrón de seguridad ya auditado del proyecto para cobros** (`20260725_lock_down_security_definer_rpcs.sql`, y el mismo camino que usa `collectMembershipPayment` en `app/actions/members.ts`): la función se revoca de `public`/`anon`/`authenticated` y se otorga únicamente a `service_role`. El permiso real (`role === 'admin' || (role === 'trainer' && can_collect_payments)`) se valida en el Server Action, con el cliente autenticado normal, **antes** de invocar la función con el cliente admin (`createAdminClient()`). Se reutiliza `canCollectPayment` de `lib/payments.ts` en vez de reimplementar la regla. Como el cliente admin no tiene JWT de usuario, `auth.uid()` no es confiable adentro de la función — igual que `extend_member_membership`, el `gym_id` y el `recorded_by` se pasan como parámetros explícitos, validados por el Server Action antes de llamar.
- **La gestión de catálogo (crear/editar producto y variante: nombre, categoría, precio, costo, imagen) es admin-only vía RLS estándar**, sin RPC — es una operación de escritura común, no necesita privilegio especial ni atomicidad de suma.
- **Una venta es de una sola variante + cantidad por vez**, sin concepto de carrito con múltiples productos agrupados en una transacción. Vender agua y una barra de proteína al mismo socio son dos acciones (dos filas en `product_sales`, cada una con su propio timestamp). Es la opción mínima que sigue siendo completamente usable; agrupar varias líneas bajo una sola "venta" queda fuera de este sub-proyecto (ver Fuera de alcance).

## Componentes

### 1. Migración: tablas `products`, `product_variants`, `product_sales`

```sql
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

-- products / product_variants: cualquier staff del gym puede leer (necesitan
-- ver el catálogo para vender); solo admin puede escribir.
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

-- product_sales: solo lectura para admin, mismo alcance que la pestaña
-- "Ventas" (admin-only, igual que /reports) — ningún trainer necesita leer
-- esta tabla para vender (record_product_sale inserta vía service_role, sin
-- pasar por RLS), así que no tiene sentido darle SELECT de más. Nunca se
-- escribe directo desde el cliente — todo insert pasa por
-- record_product_sale, así que no hace falta (ni conviene) una policy de
-- INSERT aquí.
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
```

### 2. Migración: `restock_product_variant` (SECURITY INVOKER)

```sql
create or replace function restock_product_variant(
  p_variant_id uuid,
  p_quantity   integer,
  p_new_cost   numeric default null
)
returns integer -- nuevo stock
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_new_stock integer;
begin
  if p_quantity <= 0 then
    raise exception 'La cantidad a reponer debe ser mayor a cero';
  end if;

  update product_variants
  set
    stock = stock + p_quantity,
    cost_price = coalesce(p_new_cost, cost_price)
  where id = p_variant_id
  returning stock into v_new_stock;

  -- 0 filas afectadas: o la variante no existe, o el UPDATE fue bloqueado
  -- por RLS (quien llama no es admin del gym dueño de esta variante).
  if not found then
    raise exception 'Variante no encontrada o sin permiso';
  end if;

  return v_new_stock;
end;
$$;

revoke execute on function restock_product_variant(uuid, integer, numeric) from public, anon;
grant execute on function restock_product_variant(uuid, integer, numeric) to authenticated;
```

### 3. Migración: `record_product_sale` (SECURITY DEFINER, service_role)

```sql
create or replace function record_product_sale(
  p_variant_id  uuid,
  p_gym_id      uuid,
  p_member_id   uuid,
  p_quantity    integer,
  p_recorded_by uuid
)
returns uuid -- id de la venta creada
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product     products%rowtype;
  v_variant     product_variants%rowtype;
  v_unit_price  numeric(10,2);
  v_unit_cost   numeric(10,2);
  v_sale_id     uuid;
begin
  if p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;

  select v.* into v_variant from product_variants v where v.id = p_variant_id;
  if not found then
    raise exception 'Variante no encontrada';
  end if;

  select p.* into v_product from products p where p.id = v_variant.product_id;
  if not found or v_product.gym_id != p_gym_id then
    raise exception 'La variante no pertenece a este gym';
  end if;

  if p_member_id is not null and not exists (
    select 1 from profiles where id = p_member_id and gym_id = p_gym_id
  ) then
    raise exception 'El socio no pertenece a este gym';
  end if;

  v_unit_price := coalesce(v_variant.price, v_product.base_price);
  v_unit_cost  := coalesce(v_variant.cost_price, v_product.base_cost);

  update product_variants
  set stock = stock - p_quantity
  where id = p_variant_id and stock >= p_quantity;

  if not found then
    raise exception 'Stock insuficiente';
  end if;

  insert into product_sales (
    gym_id, variant_id, member_id, quantity,
    unit_price, unit_cost, total_amount, method, recorded_by
  )
  values (
    p_gym_id, p_variant_id, p_member_id, p_quantity,
    v_unit_price, v_unit_cost, v_unit_price * p_quantity, 'cash', p_recorded_by
  )
  returning id into v_sale_id;

  return v_sale_id;
end;
$$;

revoke all on function record_product_sale(uuid, uuid, uuid, integer, uuid) from public, anon, authenticated;
grant execute on function record_product_sale(uuid, uuid, uuid, integer, uuid) to service_role;
```

### 4. `lib/products.ts` — funciones puras

```ts
export function resolveVariantPrice(
  product: { base_price: number },
  variant: { price: number | null }
): number {
  return variant.price ?? product.base_price
}

export function resolveVariantCost(
  product: { base_cost: number },
  variant: { cost_price: number | null }
): number {
  return variant.cost_price ?? product.base_cost
}

export function calculateSaleTotal(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * quantity * 100) / 100
}

export function calculateMargin(unitPrice: number, unitCost: number, quantity: number): number {
  return Math.round((unitPrice - unitCost) * quantity * 100) / 100
}
```

`calculateMargin` puede devolver un número negativo (venta a pérdida) — no es un caso de error, es información real que sub-proyecto 3 va a necesitar mostrar tal cual.

### 5. Server Actions — `app/actions/products.ts`

- `getProducts(includeInactive = false)` — staff (admin/trainer), select con variantes anidadas. Sin chequeo manual de permiso: RLS ya lo resuelve.
- `createProduct(input)` / `updateProduct(id, updates)` / `toggleProductActive(id, isActive)` — valida `role === 'admin'` leyendo `profiles` con el cliente autenticado antes de escribir (mensaje de error claro; RLS es la red de seguridad real).
- `createVariant(productId, input)` / `updateVariant(id, updates)` / `toggleVariantActive(id, isActive)` — mismo chequeo admin-only.
- `restockVariant(variantId, quantity, newCost?)` — valida `role === 'admin'`, luego llama `supabase.rpc('restock_product_variant', ...)` con el cliente **autenticado** (no admin — la función es `SECURITY INVOKER`).
- `recordSale(variantId, quantity, memberId?)` — lee `profiles` (`role`, `gym_id`, `can_collect_payments`) con el cliente autenticado, valida con `canCollectPayment(role, can_collect_payments)` (reusa `lib/payments.ts`), y si pasa, llama `createAdminClient().rpc('record_product_sale', { p_variant_id, p_gym_id: me.gym_id, p_member_id: memberId ?? null, p_quantity: quantity, p_recorded_by: user.id })`. Si la función devuelve error, se retorna `error.message` tal cual (ver Manejo de errores) — no hace falta mapeo especial.
- `getProductSales(dateRange?)` — admin only (mismo criterio que `/reports`), select simple con joins a variante/producto/socio.

### 6. UI

- **Nav**: nuevo ítem en `components/layout/Sidebar.tsx` — `{ href: "/productos", label: "Productos", icon: ShoppingBag, staffOnly: true }`, mismo mecanismo de gateo que "Personas".
- **`app/(dashboard)/productos/page.tsx`** + **`components/products/ProductsView.tsx`** con 3 tabs (mismo patrón visual de tabs que `/personas` y `/admin`):
  - **Catálogo** — lista de productos con sus variantes y stock. Admin ve botones crear/editar/desactivar producto y variante, y "Reponer stock" por variante (modal: cantidad a sumar + costo nuevo opcional). Trainer ve la misma lista en modo solo-lectura (sin esos botones) — la necesita para saber qué hay disponible y recomendarlo, no para administrarla. Cada producto se muestra con un ícono según su categoría, no una foto — subir imagen real (`image_url`) queda fuera de este sub-proyecto (ver Fuera de alcance); la columna ya existe en el schema para no tener que migrar de nuevo cuando se agregue.
  - **Vender** — visible solo si `canCollectPayment(role, can_collect_payments)` (mismo gateo que ya usa `MemberCollectPayment.tsx`). Elegir variante (con su stock visible), cantidad, socio opcional (buscador, igual que otros flujos de socio), confirmar → llama `recordSale`.
  - **Ventas** — admin only (igual que `/reports` en el sidebar), tabla simple: fecha, producto/variante, cantidad, monto, socio (o "Sin socio"), quién la registró. Sin gráficos ni totales agregados — eso es sub-proyecto 3.

### 7. Tests

- **`lib/products.test.ts`**: `resolveVariantPrice`/`resolveVariantCost` (con override y con null → fallback a base), `calculateSaleTotal`, `calculateMargin` (incluyendo margen negativo).
- **`app/actions/products.test.ts`** (usando `lib/test-utils/supabase-mock.ts` — si no existe en esta rama porque vive solo en `feat/nutrition-calc-engine` sin mergear, se recrea acá): `recordSale` — admin puede vender; trainer sin `can_collect_payments` es rechazado; trainer con el flag puede vender; stock insuficiente devuelve el mensaje de error correcto sin descontar stock; socio de otro gym es rechazado. `restockVariant` — admin puede reponer; trainer es rechazado. `createProduct`/`updateProduct` — no-admin rechazado.

## Manejo de errores

- **Venta con stock insuficiente**: `record_product_sale` revierte todo (una sola transacción implícita de función) y lanza `raise exception 'Stock insuficiente'`. El Server Action no necesita mapear nada especial — igual que `collectMembershipPayment` con sus errores no-`23505`, alcanza con devolver `error.message` tal cual llega de Postgres; el mensaje ya es apto para mostrar al usuario.
- **Reposición con cantidad ≤ 0**: rechazada en la función antes de tocar la fila.
- **Trainer sin `can_collect_payments` intenta vender**: rechazado en el Server Action antes de tocar la base — mismo punto de falla que ya existe hoy para `collectMembershipPayment`.
- **Producto/variante desactivado**: sigue siendo vendible vía `record_product_sale` si se lo llama directo (la función no chequea `is_active`) — pero la UI de "Vender" solo lista variantes con `is_active = true`, así que en la práctica no aparece como opción. Se documenta la asimetría a propósito: es la UI la que oculta lo inactivo, no una regla de negocio en la base.
- **Socio (`member_id`) de otro gym**: rechazado dentro de `record_product_sale`, mismo patrón defensivo que `extend_member_membership`.

## Fuera de alcance

- Cobro de productos vía MercadoPago (sub-proyecto 2).
- Reportes/métricas de ventas — totales, más vendidos, ganancia del mes (sub-proyecto 3). Este sub-proyecto solo deja el dato grabado correctamente para que sub-proyecto 3 lo agregue.
- Carrito con múltiples productos agrupados en una sola transacción/recibo — cada venta es de una variante a la vez, cada una su propia fila en `product_sales`.
- Registro histórico de compras a proveedores (fecha, proveedor, costo por compra) — `restock_product_variant` solo actualiza el costo "más reciente conocido", no lleva un historial de compras.
- Costeo por lote/FIFO — no se distingue de qué reposición viene cada unidad vendida.
- Borrado físico de productos o variantes — solo desactivación (`is_active`).
- Subir/mostrar foto real de producto — `products.image_url` queda en el schema sin usar todavía; el catálogo muestra un ícono por categoría. Requeriría un bucket de Storage nuevo con sus propias policies (mismo patrón que `machine-images`/`food-photos`), que no se justifica para este sub-proyecto.
