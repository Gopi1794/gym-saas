# Catálogo de productos, stock y venta en efectivo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar de alta un catálogo de productos físicos (agua, suplementos, ropa) con variantes, stock y costo, y permitir venderlos en efectivo desde `/productos`.

**Architecture:** 3 tablas nuevas (`products`, `product_variants`, `product_sales`) con RLS estándar para lectura/escritura de catálogo; dos funciones Postgres para las dos únicas operaciones que tocan stock (`restock_product_variant` con `SECURITY INVOKER`, `record_product_sale` con `SECURITY DEFINER` bloqueada a `service_role`, replicando el patrón ya auditado de `extend_member_membership`); Server Actions en `app/actions/products.ts`; UI en `/productos` con 3 tabs (Catálogo, Vender, Ventas) reusando `TabSwitcher`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + RLS), vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-product-sales-catalog-design.md`

## Global Constraints

- Toda venta referencia una variante (`product_variants`), nunca un producto pelado — todo producto tiene al menos una variante.
- Sin borrado físico de productos ni variantes — solo `is_active`. No se construye ningún botón "Eliminar".
- `product_sales.unit_price` y `unit_cost` se congelan en el momento de la venta (no se recalculan después aunque cambie el costo del producto).
- El stock nunca se escribe con `.update()` directo desde el cliente — solo vía `restock_product_variant` (admin) o `record_product_sale` (admin/trainer con `can_collect_payments`), ambas funciones Postgres.
- Toda venta es de una sola variante + cantidad. No hay carrito multi-producto en este sub-proyecto.
- Multi-tenancy: toda query queda acotada explícitamente por `gym_id`, además de lo que RLS ya garantiza (no confiar solo en RLS — es la convención ya usada en `app/actions/members.ts` y `app/(dashboard)/admin/page.tsx`).
- Fechas: `product_sales.created_at` es un instante real (no una fecha de calendario) — se muestra con `formatInstantAR` de `lib/date-ar.ts`, nunca con `.toLocaleDateString()` sin `timeZone` explícito.
- Toda función nueva de este plan usa `set search_path = public` y fija sus propios `revoke`/`grant` — nunca hereda permisos de PUBLIC por defecto.
- Toda funcionalidad nueva lleva sus tests unitarios en el mismo commit que la implementa (no se difiere "agregar tests después").
- Al final de cada task, correr `npx tsc --noEmit` para confirmar que el proyecto sigue tipando — no se corre `npm run build` (regla del usuario).

---

### Task 1: Migración — tablas `products`, `product_variants`, `product_sales`

**Files:**
- Create: `supabase/migrations/20260815_products_catalog.sql`

**Interfaces:**
- Produces: tablas `products(id, gym_id, name, description, category, image_url, base_price, base_cost, is_active, created_by, created_at)`, `product_variants(id, product_id, name, sku, price, cost_price, stock, is_active, created_at)`, `product_sales(id, gym_id, variant_id, member_id, quantity, unit_price, unit_cost, total_amount, method, recorded_by, created_at)`. Todas las tasks siguientes dependen de este esquema exacto.

- [ ] **Step 1: Escribir la migración**

```sql
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
```

- [ ] **Step 2: Aplicar la migración a la base remota**

Run: `supabase db query --linked -f supabase/migrations/20260815_products_catalog.sql`

Expected: sin errores (`{"rows": [], ...}` o similar salida vacía de éxito). **Nunca usar `supabase db push`** — la tabla de historial de migraciones remota de este proyecto no está poblada, `db push` intentaría replayear ~90 migraciones históricas.

- [ ] **Step 3: Verificar el esquema aplicado**

Run:
```bash
supabase db query --linked -f - <<'EOF'
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name in ('products', 'product_variants', 'product_sales')
order by table_name, ordinal_position;
EOF
```

Expected: 12 filas para `products`, 8 para `product_variants`, 11 para `product_sales`, coincidiendo con las columnas definidas arriba.

Run:
```bash
supabase db query --linked -f - <<'EOF'
select tablename, policyname from pg_policies
where tablename in ('products', 'product_variants', 'product_sales')
order by tablename;
EOF
```

Expected: 5 filas (2 en `products`, 2 en `product_variants`, 1 en `product_sales`), con los nombres exactos usados arriba.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260815_products_catalog.sql
git commit -m "feat(productos): tablas de catalogo, variantes y ventas con RLS"
```

---

### Task 2: Migración — funciones `restock_product_variant` y `record_product_sale`

**Files:**
- Create: `supabase/migrations/20260815_product_sale_functions.sql`

**Interfaces:**
- Consumes: tablas de Task 1.
- Produces: función `restock_product_variant(p_variant_id uuid, p_quantity integer, p_new_cost numeric default null) returns integer`, invocable por `authenticated`. Función `record_product_sale(p_variant_id uuid, p_gym_id uuid, p_member_id uuid, p_quantity integer, p_recorded_by uuid) returns uuid`, invocable únicamente por `service_role`. Task 5 (Server Actions) llama a ambas por nombre y con estos parámetros exactos.

- [ ] **Step 1: Escribir la migración**

```sql
-- Las dos únicas operaciones que pueden tocar product_variants.stock.
-- Nivel de privilegio distinto para cada una porque cada caso lo necesita
-- distinto (mismo criterio ya usado en el proyecto para
-- clone_workout_plan_for_member vs. extend_member_membership) — ver spec:
-- docs/superpowers/specs/2026-08-15-product-sales-catalog-design.md

-- Reponer stock: admin-only. SECURITY INVOKER porque la RLS de
-- product_variants ya limita el UPDATE a admin del mismo gym — no hace
-- falta bypasear nada. Existe como función (no como .update() directo del
-- cliente) porque necesita sumar sobre el valor actual (stock = stock + N).
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

-- Vender: admin o trainer con can_collect_payments. SECURITY DEFINER
-- porque un trainer no tiene (ni debe tener) UPDATE general sobre
-- product_variants — la función bypasea RLS únicamente para esta
-- operación puntual, atómicamente (UPDATE ... WHERE stock >= cantidad
-- evita condición de carrera). Sigue el mismo patrón de seguridad ya
-- auditado que extend_member_membership: revocada de authenticated,
-- otorgada solo a service_role. El permiso real se valida en el Server
-- Action ANTES de invocarla (Task 5) — auth.uid() no es confiable acá
-- porque el cliente admin no tiene JWT de usuario, por eso p_gym_id y
-- p_recorded_by se reciben como parámetros explícitos.
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

- [ ] **Step 2: Aplicar la migración a la base remota**

Run: `supabase db query --linked -f supabase/migrations/20260815_product_sale_functions.sql`

Expected: sin errores.

- [ ] **Step 3: Verificar existencia y grants**

Run:
```bash
supabase db query --linked -f - <<'EOF'
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('restock_product_variant', 'record_product_sale');
EOF
```

Expected: las 2 filas.

Run:
```bash
supabase db query --linked -f - <<'EOF'
select routine_name, grantee, privilege_type from information_schema.role_routine_grants
where routine_name in ('restock_product_variant', 'record_product_sale')
order by routine_name, grantee;
EOF
```

Expected: `restock_product_variant` otorgada a `authenticated` únicamente; `record_product_sale` otorgada a `service_role` únicamente. Si aparece `authenticated` o `anon` con privilegio sobre `record_product_sale`, la migración no revocó correctamente — no continuar hasta corregirlo.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260815_product_sale_functions.sql
git commit -m "feat(productos): funciones restock_product_variant y record_product_sale"
```

---

### Task 3: `lib/products.ts` — funciones puras

**Files:**
- Create: `lib/products.ts`
- Test: `lib/products.test.ts`

**Interfaces:**
- Produces: `resolveVariantPrice(product, variant): number`, `resolveVariantCost(product, variant): number`, `calculateSaleTotal(unitPrice, quantity): number`, `calculateMargin(unitPrice, unitCost, quantity): number`. Task 6-9 (UI) los usan para previsualizar precio/total antes de confirmar una venta.

- [ ] **Step 1: Escribir los tests (deben fallar — el archivo `lib/products.ts` todavía no existe)**

```ts
import { describe, it, expect } from "vitest"
import { resolveVariantPrice, resolveVariantCost, calculateSaleTotal, calculateMargin } from "./products"

describe("resolveVariantPrice", () => {
  it("usa el precio de la variante cuando está definido", () => {
    expect(resolveVariantPrice({ base_price: 1000 }, { price: 1500 })).toBe(1500)
  })

  it("cae al precio base del producto cuando la variante no tiene precio propio", () => {
    expect(resolveVariantPrice({ base_price: 1000 }, { price: null })).toBe(1000)
  })
})

describe("resolveVariantCost", () => {
  it("usa el costo de la variante cuando está definido", () => {
    expect(resolveVariantCost({ base_cost: 400 }, { cost_price: 600 })).toBe(600)
  })

  it("cae al costo base del producto cuando la variante no tiene costo propio", () => {
    expect(resolveVariantCost({ base_cost: 400 }, { cost_price: null })).toBe(400)
  })
})

describe("calculateSaleTotal", () => {
  it("multiplica precio unitario por cantidad", () => {
    expect(calculateSaleTotal(1500, 3)).toBe(4500)
  })

  it("redondea a 2 decimales", () => {
    expect(calculateSaleTotal(10.005, 3)).toBe(30.02)
  })
})

describe("calculateMargin", () => {
  it("calcula la ganancia total de la venta", () => {
    expect(calculateMargin(1500, 900, 2)).toBe(1200)
  })

  it("puede ser negativo si se vende a pérdida — no es un caso de error", () => {
    expect(calculateMargin(500, 900, 1)).toBe(-400)
  })

  it("es cero cuando precio y costo son iguales", () => {
    expect(calculateMargin(1000, 1000, 5)).toBe(0)
  })
})
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `npx vitest run lib/products.test.ts`
Expected: FAIL — `Cannot find module './products'` o equivalente (el archivo no existe todavía).

- [ ] **Step 3: Implementar `lib/products.ts`**

```ts
// resolveVariantPrice/resolveVariantCost: cada variante puede fijar su
// propio precio/costo, o heredar el del producto (útil para productos con
// variantes de igual valor, ej. una remera talle S/M/L al mismo precio).
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

// Puede devolver un número negativo (venta a pérdida) — es información
// real, no un caso de error; sub-proyecto 3 (reportes) la necesita tal cual.
export function calculateMargin(unitPrice: number, unitCost: number, quantity: number): number {
  return Math.round((unitPrice - unitCost) * quantity * 100) / 100
}
```

- [ ] **Step 4: Correr los tests para confirmar que pasan**

Run: `npx vitest run lib/products.test.ts`
Expected: PASS — 9 tests verdes (2 `resolveVariantPrice` + 2 `resolveVariantCost` + 2 `calculateSaleTotal` + 3 `calculateMargin`).

- [ ] **Step 5: Commit**

```bash
git add lib/products.ts lib/products.test.ts
git commit -m "feat(productos): funciones puras de resolucion de precio, costo y margen"
```

---

### Task 4: Server Actions — catálogo (`app/actions/products.ts`, parte 1) + mock de Supabase para tests

**Files:**
- Create: `lib/test-utils/supabase-mock.ts`
- Create: `app/actions/products.ts`
- Test: `app/actions/products.test.ts`

**Interfaces:**
- Consumes: tablas de Task 1.
- Produces: tipos `ProductCategory`, `ProductVariant`, `Product` (exportados desde `app/actions/products.ts`); funciones `getProducts(includeInactive?: boolean)`, `createProduct(input: CreateProductInput)`, `updateProduct(productId: string, input: UpdateProductInput)`, `toggleProductActive(productId: string, isActive: boolean)`, `createVariant(productId: string, input: CreateVariantInput)`, `updateVariant(variantId: string, input: UpdateVariantInput)`, `toggleVariantActive(variantId: string, isActive: boolean)`. Task 5 agrega al mismo archivo `restockVariant`/`recordSale`/`getProductSales`. Task 7 (UI Catálogo) consume estas 7 funciones y los tipos.
- El mock `lib/test-utils/supabase-mock.ts` no existe todavía en esta rama (vive sin mergear en `feat/nutrition-calc-engine`) — se recrea acá, extendido con soporte para `.rpc()` que la versión original no tenía (lo necesita Task 5).

- [ ] **Step 1: Crear el mock reusable de Supabase**

```ts
import { vi } from "vitest"

export type MockResult = { data: unknown; error: unknown }

/**
 * Query builder de Supabase encadenable para tests. Cada método de
 * filtro/modificación devuelve el mismo objeto (para seguir encadenando);
 * tanto los métodos terminales (.single()/.maybeSingle()) como el await
 * directo del builder (cuando el código no llama a ninguno de los dos,
 * como `.update(...).eq(...)` sin `.single()`) resuelven al mismo
 * resultado configurado.
 */
export function chainableResult(result: MockResult) {
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    or: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: MockResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return chain
}

/**
 * Mock de un cliente Supabase completo. `fromResults` es la lista de
 * resultados que devuelve cada llamada sucesiva a `.from(...)`, EN ORDEN —
 * hay que conocer cuántas veces y en qué orden la función bajo test llama
 * a `.from()`, incluyendo llamadas indirectas.
 *
 * `mockSupabase.chains[i]` guarda el builder devuelto por la i-ésima
 * llamada a `.from()`, así un test puede assertar sobre qué se le pasó a
 * `.insert()`/`.update()`/`.upsert()` en esa llamada puntual.
 *
 * `.rpc(...)` es independiente de `.from(...)` — se configura aparte con
 * `mockSupabase.rpc.mockResolvedValueOnce({ data, error })` en cada test
 * que lo necesite. Devuelve `{ data: null, error: null }` por defecto.
 */
export function createMockSupabase(fromResults: MockResult[] = []) {
  const chains = fromResults.map(chainableResult)
  let call = 0
  const from = vi.fn(() => {
    const chain = chains[call] ?? chainableResult({ data: null, error: null })
    call++
    return chain
  })
  return {
    from,
    auth: { getUser: vi.fn() },
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
    chains,
  }
}
```

- [ ] **Step 2: Escribir los tests de catálogo (deben fallar — `app/actions/products.ts` todavía no existe)**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { createMockSupabase } from "@/lib/test-utils/supabase-mock"

const mockCreateClient = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}))
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}))

import {
  getProducts, createProduct, updateProduct, toggleProductActive,
  createVariant, updateVariant, toggleVariantActive,
} from "./products"

function mockUser(id: string | null) {
  return { data: { user: id ? { id } : null } }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("getProducts", () => {
  it("devuelve solo los productos activos por defecto", async () => {
    const supabase = createMockSupabase([
      { data: { gym_id: "gym-1" }, error: null }, // profiles (gym_id)
      {
        data: [
          { id: "p1", is_active: true, product_variants: [] },
          { id: "p2", is_active: false, product_variants: [] },
        ],
        error: null,
      }, // products
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProducts()

    expect(result).toEqual({ products: [{ id: "p1", is_active: true, product_variants: [] }] })
  })

  it("con includeInactive, devuelve también los desactivados", async () => {
    const supabase = createMockSupabase([
      { data: { gym_id: "gym-1" }, error: null },
      {
        data: [
          { id: "p1", is_active: true, product_variants: [] },
          { id: "p2", is_active: false, product_variants: [] },
        ],
        error: null,
      },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProducts(true)

    expect(result.products).toHaveLength(2)
  })
})

describe("createProduct", () => {
  const INPUT = {
    name: "Whey Protein",
    description: null,
    category: "suplementos" as const,
    basePrice: 15000,
    baseCost: 9000,
  }

  it("un admin puede crear un producto", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null }, // me
      { data: { id: "new-product-1" }, error: null }, // insert
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createProduct(INPUT)

    expect(result).toEqual({ success: true, id: "new-product-1" })
    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toMatchObject({
      gym_id: "gym-1",
      name: "Whey Protein",
      category: "suplementos",
      base_price: 15000,
      base_cost: 9000,
      created_by: "admin-1",
    })
  })

  it("un trainer no puede crear productos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createProduct(INPUT)

    expect(result).toEqual({ error: "Solo un admin puede crear productos" })
    expect(supabase.from).toHaveBeenCalledTimes(1) // nunca llega al insert
  })

  it("rechaza un precio negativo antes de escribir", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createProduct({ ...INPUT, basePrice: -100 })

    expect(result).toEqual({ error: "El precio no puede ser negativo" })
  })
})

describe("updateProduct", () => {
  it("un admin puede actualizar el nombre", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [{ id: "product-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateProduct("product-1", { name: "Whey Protein Doble Chocolate" })

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[1].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({ name: "Whey Protein Doble Chocolate" })
  })

  it("un trainer no puede actualizar productos", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateProduct("product-1", { name: "x" })

    expect(result).toEqual({ error: "Solo un admin puede editar productos" })
  })

  it("un producto de otro gym no matchea el UPDATE y devuelve error en vez de éxito silencioso", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [], error: null }, // el .eq("gym_id", ...) no matchea ninguna fila
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateProduct("product-de-otro-gym", { name: "x" })

    expect(result).toEqual({ error: "Producto no encontrado" })
  })
})

describe("toggleProductActive", () => {
  it("un admin puede desactivar un producto", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [{ id: "product-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await toggleProductActive("product-1", false)

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[1].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({ is_active: false })
  })
})

describe("createVariant", () => {
  const INPUT = { name: "1kg", sku: null, price: null, costPrice: null, stock: 10 }

  it("un admin puede crear una variante", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: { id: "variant-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createVariant("product-1", INPUT)

    expect(result).toEqual({ success: true, id: "variant-1" })
    const insertPayload = (supabase.chains[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toEqual({
      product_id: "product-1",
      name: "1kg",
      sku: null,
      price: null,
      cost_price: null,
      stock: 10,
    })
  })

  it("un trainer no puede crear variantes", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createVariant("product-1", INPUT)

    expect(result).toEqual({ error: "Solo un admin puede crear variantes" })
  })

  it("rechaza un stock inicial negativo", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await createVariant("product-1", { ...INPUT, stock: -5 })

    expect(result).toEqual({ error: "El stock inicial no puede ser negativo" })
  })
})

describe("updateVariant", () => {
  it("un admin puede actualizar el precio", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: [{ id: "variant-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateVariant("variant-1", { price: 1800 })

    expect(result).toEqual({ success: true })
    const updatePayload = (supabase.chains[1].update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updatePayload).toEqual({ price: 1800 })
  })

  it("una variante que no matchea el UPDATE (de otro gym, o inexistente) devuelve error en vez de éxito silencioso", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: [], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateVariant("variant-de-otro-gym", { price: 1800 })

    expect(result).toEqual({ error: "Variante no encontrada" })
  })

  it("un trainer no puede actualizar variantes", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await updateVariant("variant-1", { price: 1800 })

    expect(result).toEqual({ error: "Solo un admin puede editar variantes" })
  })
})

describe("toggleVariantActive", () => {
  it("un admin puede desactivar una variante", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
      { data: [{ id: "variant-1" }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await toggleVariantActive("variant-1", false)

    expect(result).toEqual({ success: true })
  })

  it("un trainer no puede desactivar variantes", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await toggleVariantActive("variant-1", false)

    expect(result).toEqual({ error: "Solo un admin puede desactivar variantes" })
  })
})
```

- [ ] **Step 3: Correr los tests para confirmar que fallan**

Run: `npx vitest run app/actions/products.test.ts`
Expected: FAIL — `Cannot find module './products'`.

- [ ] **Step 4: Implementar `app/actions/products.ts` (parte 1 — catálogo)**

```ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type ProductCategory = "bebidas" | "suplementos" | "indumentaria" | "accesorios" | "otro"

export type ProductVariant = {
  id: string
  product_id: string
  name: string
  sku: string | null
  price: number | null
  cost_price: number | null
  stock: number
  is_active: boolean
}

export type Product = {
  id: string
  gym_id: string
  name: string
  description: string | null
  category: ProductCategory
  image_url: string | null
  base_price: number
  base_cost: number
  is_active: boolean
  product_variants: ProductVariant[]
}

export async function getProducts(includeInactive = false) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("gym_id")
    .eq("id", user.id)
    .single()

  if (!me) return { error: "Sin permiso" }

  const { data, error } = await (supabase
    .from("products" as never)
    .select("*, product_variants(*)")
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .order("name") as unknown as Promise<{ data: Product[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  const products = includeInactive ? (data ?? []) : (data ?? []).filter(p => p.is_active)
  return { products }
}

export type CreateProductInput = {
  name: string
  description: string | null
  category: ProductCategory
  basePrice: number
  baseCost: number
}

export async function createProduct(input: CreateProductInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede crear productos" }
  }

  if (!input.name.trim()) return { error: "El nombre es obligatorio" }
  if (input.basePrice < 0) return { error: "El precio no puede ser negativo" }
  if (input.baseCost < 0) return { error: "El costo no puede ser negativo" }

  const { data, error } = await (supabase
    .from("products" as never)
    .insert({
      gym_id: (me as { gym_id: string }).gym_id,
      name: input.name.trim(),
      description: input.description,
      category: input.category,
      base_price: input.basePrice,
      base_cost: input.baseCost,
      created_by: user.id,
    } as never)
    .select("id")
    .single() as unknown as Promise<{ data: { id: string } | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  return { success: true, id: data!.id }
}

export type UpdateProductInput = {
  name?: string
  description?: string | null
  category?: ProductCategory
  basePrice?: number
  baseCost?: number
}

export async function updateProduct(productId: string, input: UpdateProductInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede editar productos" }
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) {
    if (!input.name.trim()) return { error: "El nombre es obligatorio" }
    updates.name = input.name.trim()
  }
  if (input.description !== undefined) updates.description = input.description
  if (input.category !== undefined) updates.category = input.category
  if (input.basePrice !== undefined) {
    if (input.basePrice < 0) return { error: "El precio no puede ser negativo" }
    updates.base_price = input.basePrice
  }
  if (input.baseCost !== undefined) {
    if (input.baseCost < 0) return { error: "El costo no puede ser negativo" }
    updates.base_cost = input.baseCost
  }

  // .eq("gym_id", ...) además de RLS: no alcanza con confiar en que la
  // policy bloquee un producto de otro gym — un UPDATE cuyo WHERE no
  // matchea ninguna fila no lanza error (a diferencia de un INSERT que
  // viola su policy), así que sin este chequeo explícito la función
  // devolvería { success: true } sin haber tocado nada.
  const { data, error } = await (supabase
    .from("products" as never)
    .update(updates as never)
    .eq("id", productId)
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Producto no encontrado" }

  revalidatePath("/productos")
  return { success: true }
}

export async function toggleProductActive(productId: string, isActive: boolean) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede desactivar productos" }
  }

  const { data, error } = await (supabase
    .from("products" as never)
    .update({ is_active: isActive } as never)
    .eq("id", productId)
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Producto no encontrado" }

  revalidatePath("/productos")
  return { success: true }
}

export type CreateVariantInput = {
  name: string
  sku: string | null
  price: number | null
  costPrice: number | null
  stock: number
}

export async function createVariant(productId: string, input: CreateVariantInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede crear variantes" }
  }

  if (!input.name.trim()) return { error: "El nombre de la variante es obligatorio" }
  if (input.price !== null && input.price < 0) return { error: "El precio no puede ser negativo" }
  if (input.costPrice !== null && input.costPrice < 0) return { error: "El costo no puede ser negativo" }
  if (input.stock < 0) return { error: "El stock inicial no puede ser negativo" }

  const { data, error } = await (supabase
    .from("product_variants" as never)
    .insert({
      product_id: productId,
      name: input.name.trim(),
      sku: input.sku,
      price: input.price,
      cost_price: input.costPrice,
      stock: input.stock,
    } as never)
    .select("id")
    .single() as unknown as Promise<{ data: { id: string } | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  return { success: true, id: data!.id }
}

export type UpdateVariantInput = {
  name?: string
  sku?: string | null
  price?: number | null
  costPrice?: number | null
}

export async function updateVariant(variantId: string, input: UpdateVariantInput) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede editar variantes" }
  }

  const updates: Record<string, unknown> = {}
  if (input.name !== undefined) {
    if (!input.name.trim()) return { error: "El nombre de la variante es obligatorio" }
    updates.name = input.name.trim()
  }
  if (input.sku !== undefined) updates.sku = input.sku
  if (input.price !== undefined) {
    if (input.price !== null && input.price < 0) return { error: "El precio no puede ser negativo" }
    updates.price = input.price
  }
  if (input.costPrice !== undefined) {
    if (input.costPrice !== null && input.costPrice < 0) return { error: "El costo no puede ser negativo" }
    updates.cost_price = input.costPrice
  }

  // product_variants no tiene columna gym_id propia (se llega al gym vía
  // product_id -> products.gym_id), así que acá el chequeo de tenant lo
  // hace la RLS de la tabla (join contra products+profiles) — pero igual
  // hay que leer .select("id") y confirmar que devolvió fila: un UPDATE
  // bloqueado por RLS matchea 0 filas sin lanzar error, y sin este chequeo
  // la función reportaría éxito sin haber cambiado nada.
  const { data, error } = await (supabase
    .from("product_variants" as never)
    .update(updates as never)
    .eq("id", variantId)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Variante no encontrada" }

  revalidatePath("/productos")
  return { success: true }
}

export async function toggleVariantActive(variantId: string, isActive: boolean) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede desactivar variantes" }
  }

  const { data, error } = await (supabase
    .from("product_variants" as never)
    .update({ is_active: isActive } as never)
    .eq("id", variantId)
    .select("id") as unknown as Promise<{ data: { id: string }[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: "Variante no encontrada" }

  revalidatePath("/productos")
  return { success: true }
}
```

- [ ] **Step 5: Correr los tests para confirmar que pasan**

Run: `npx vitest run app/actions/products.test.ts`
Expected: PASS — 17 tests verdes (2 `getProducts` + 3 `createProduct` + 3 `updateProduct` + 1 `toggleProductActive` + 3 `createVariant` + 3 `updateVariant` + 2 `toggleVariantActive`).

- [ ] **Step 6: Commit**

```bash
git add lib/test-utils/supabase-mock.ts app/actions/products.ts app/actions/products.test.ts
git commit -m "feat(productos): server actions de catalogo (crear/editar/desactivar producto y variante)"
```

---

### Task 5: Server Actions — reponer stock y vender (`app/actions/products.ts`, parte 2)

**Files:**
- Modify: `app/actions/products.ts` (agregar al final del archivo)
- Modify: `app/actions/products.test.ts` (agregar tests)

**Interfaces:**
- Consumes: `restock_product_variant`/`record_product_sale` (Task 2, vía `.rpc()`); `canCollectPayment` de `lib/payments.ts` (ya existente en el proyecto, firma `canCollectPayment(role: string, canCollectFlag: boolean): boolean`); `createAdminClient` de `@/lib/supabase/admin` (ya existente).
- Produces: `restockVariant(variantId: string, quantity: number, newCost?: number | null)`, `recordSale(variantId: string, quantity: number, memberId?: string | null)`, `getProductSales()` retornando `{ sales: ProductSaleRow[] }` con `ProductSaleRow` exportado. Task 8 (Vender) usa `recordSale`. Task 7 (Catálogo) usa `restockVariant`. Task 9 (Ventas) usa `getProductSales` y `ProductSaleRow`.

- [ ] **Step 1: Agregar los tests (deben fallar — las funciones todavía no existen)**

Cambiar la línea de import existente en `app/actions/products.test.ts` (la que trae `getProducts, createProduct, updateProduct, toggleProductActive`) para que también traiga `restockVariant, recordSale, getProductSales`:

```ts
import { getProducts, createProduct, updateProduct, toggleProductActive, restockVariant, recordSale, getProductSales } from "./products"
```

Y agregar al final del archivo:

```ts
describe("restockVariant", () => {
  it("un admin puede reponer stock", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null }, // me
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    supabase.rpc.mockResolvedValueOnce({ data: 30, error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await restockVariant("variant-1", 20)

    expect(result).toEqual({ success: true, newStock: 30 })
    expect(supabase.rpc).toHaveBeenCalledWith("restock_product_variant", {
      p_variant_id: "variant-1",
      p_quantity: 20,
      p_new_cost: null,
    })
  })

  it("un trainer no puede reponer stock", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await restockVariant("variant-1", 20)

    expect(result).toEqual({ error: "Solo un admin puede reponer stock" })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("rechaza una cantidad de cero antes de llamar al RPC", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await restockVariant("variant-1", 0)

    expect(result).toEqual({ error: "La cantidad a reponer debe ser mayor a cero" })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe("recordSale", () => {
  it("un admin puede vender", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    supabase.rpc.mockResolvedValueOnce({ data: "sale-1", error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale("variant-1", 2, "member-1")

    expect(result).toEqual({ success: true, saleId: "sale-1" })
    expect(supabase.rpc).toHaveBeenCalledWith("record_product_sale", {
      p_variant_id: "variant-1",
      p_gym_id: "gym-1",
      p_member_id: "member-1",
      p_quantity: 2,
      p_recorded_by: "admin-1",
    })
  })

  it("un trainer con can_collect_payments puede vender", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1", can_collect_payments: true }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    supabase.rpc.mockResolvedValueOnce({ data: "sale-2", error: null })
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale("variant-1", 1, null)

    expect(result).toEqual({ success: true, saleId: "sale-2" })
  })

  it("un trainer sin can_collect_payments no puede vender", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale("variant-1", 1, null)

    expect(result).toEqual({ error: "Sin permiso para vender productos" })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it("stock insuficiente devuelve el error del RPC tal cual", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1", can_collect_payments: false }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "Stock insuficiente" } })
    mockCreateClient.mockReturnValue(supabase)

    const result = await recordSale("variant-1", 999, null)

    expect(result).toEqual({ error: "Stock insuficiente" })
  })
})

describe("getProductSales", () => {
  it("un admin puede ver el historial de ventas", async () => {
    const supabase = createMockSupabase([
      { data: { role: "admin", gym_id: "gym-1" }, error: null },
      { data: [{ id: "sale-1", quantity: 2, unit_price: 1500, unit_cost: 900, total_amount: 3000, created_at: "2026-08-15T12:00:00Z", product_variants: null, profiles: null }], error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("admin-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProductSales()

    expect(result.sales).toHaveLength(1)
  })

  it("un trainer no puede ver el historial de ventas", async () => {
    const supabase = createMockSupabase([
      { data: { role: "trainer", gym_id: "gym-1" }, error: null },
    ])
    supabase.auth.getUser.mockResolvedValue(mockUser("trainer-1"))
    mockCreateClient.mockReturnValue(supabase)

    const result = await getProductSales()

    expect(result).toEqual({ error: "Solo un admin puede ver el historial de ventas" })
  })
})
```

- [ ] **Step 2: Correr los tests para confirmar que fallan**

Run: `npx vitest run app/actions/products.test.ts`
Expected: FAIL — `restockVariant`/`recordSale`/`getProductSales` no exportados todavía.

- [ ] **Step 3: Agregar la implementación al final de `app/actions/products.ts`**

```ts
import { createAdminClient } from "@/lib/supabase/admin"
import { canCollectPayment } from "@/lib/payments"

export async function restockVariant(variantId: string, quantity: number, newCost?: number | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede reponer stock" }
  }

  if (quantity <= 0) return { error: "La cantidad a reponer debe ser mayor a cero" }

  const { data, error } = await (supabase.rpc("restock_product_variant" as never, {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_new_cost: newCost ?? null,
  } as never) as unknown as Promise<{ data: number | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  return { success: true, newStock: data }
}

export async function recordSale(variantId: string, quantity: number, memberId?: string | null) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id, can_collect_payments")
    .eq("id", user.id)
    .single()

  if (!me) return { error: "Sin permiso" }

  const profile = me as { role: string; gym_id: string; can_collect_payments: boolean }
  if (!canCollectPayment(profile.role, profile.can_collect_payments === true)) {
    return { error: "Sin permiso para vender productos" }
  }

  if (quantity <= 0) return { error: "La cantidad debe ser mayor a cero" }

  const admin = createAdminClient()
  const { data, error } = await (admin.rpc("record_product_sale" as never, {
    p_variant_id: variantId,
    p_gym_id: profile.gym_id,
    p_member_id: memberId ?? null,
    p_quantity: quantity,
    p_recorded_by: user.id,
  } as never) as unknown as Promise<{ data: string | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  revalidatePath("/productos")
  return { success: true, saleId: data }
}

export type ProductSaleRow = {
  id: string
  quantity: number
  unit_price: number
  unit_cost: number
  total_amount: number
  created_at: string
  product_variants: { name: string; products: { name: string } | null } | null
  profiles: { full_name: string | null } | null
}

export async function getProductSales() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "No autenticado" }

  const { data: me } = await supabase
    .from("profiles")
    .select("role, gym_id")
    .eq("id", user.id)
    .single()

  if (!me || (me as { role: string }).role !== "admin") {
    return { error: "Solo un admin puede ver el historial de ventas" }
  }

  // profiles!product_sales_member_id_fkey: product_sales tiene DOS FKs a
  // profiles (member_id y recorded_by) — sin el hint del nombre de
  // constraint, PostgREST no sabe cuál de las dos usar para el embed y
  // devuelve un error de relación ambigua (mismo patrón ya usado en
  // app/actions/nutrition.ts con nutrition_plans, que tiene la misma forma).
  const { data, error } = await (supabase
    .from("product_sales" as never)
    .select("id, quantity, unit_price, unit_cost, total_amount, created_at, product_variants(name, products(name)), profiles!product_sales_member_id_fkey(full_name)")
    .eq("gym_id", (me as { gym_id: string }).gym_id)
    .order("created_at", { ascending: false })
    .limit(200) as unknown as Promise<{ data: ProductSaleRow[] | null; error: { message: string } | null }>)

  if (error) return { error: error.message }

  return { sales: data ?? [] }
}
```

Mover el `import { createAdminClient } from "@/lib/supabase/admin"` y `import { canCollectPayment } from "@/lib/payments"` al bloque de imports que ya está al principio del archivo (junto a `createClient`/`revalidatePath`), no dejarlos sueltos en medio del archivo.

- [ ] **Step 4: Correr los tests para confirmar que pasan**

Run: `npx vitest run app/actions/products.test.ts`
Expected: PASS — 26 tests verdes en total (17 de Task 4 + 3 `restockVariant` + 4 `recordSale` + 2 `getProductSales` de este step).

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add app/actions/products.ts app/actions/products.test.ts
git commit -m "feat(productos): server actions de reposicion de stock y venta"
```

---

### Task 6: `components/products/ProductCatalogPanel.tsx` — pestaña Catálogo

**Files:**
- Create: `components/products/ProductFormDialog.tsx`
- Create: `components/products/VariantFormDialog.tsx`
- Create: `components/products/RestockDialog.tsx`
- Create: `components/products/ProductCatalogPanel.tsx`

**Interfaces:**
- Consumes: `Product`, `ProductVariant`, `ProductCategory`, `createProduct`, `updateProduct`, `toggleProductActive`, `createVariant`, `updateVariant`, `toggleVariantActive`, `restockVariant` (Task 4/5, `@/app/actions/products`).
- Produces: `ProductCatalogPanel({ products, isAdmin }: { products: Product[]; isAdmin: boolean })`. Task 10 lo monta en la pestaña "Catálogo".

- [ ] **Step 1: `components/products/ProductFormDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { createProduct, updateProduct, type Product, type ProductCategory } from "@/app/actions/products"

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  bebidas: "Bebidas",
  suplementos: "Suplementos",
  indumentaria: "Indumentaria",
  accesorios: "Accesorios",
  otro: "Otro",
}

interface Props {
  product?: Product
  trigger: React.ReactNode
}

export default function ProductFormDialog({ product, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(product?.name ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? "otro")
  const [basePrice, setBasePrice] = useState(String(product?.base_price ?? ""))
  const [baseCost, setBaseCost] = useState(String(product?.base_cost ?? ""))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const input = {
      name,
      description: description.trim() || null,
      category,
      basePrice: Number(basePrice),
      baseCost: Number(baseCost),
    }

    const result = product
      ? await updateProduct(product.id, input)
      : await createProduct(input)

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="ej. Whey Protein" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Categoría *</label>
            <select
              required
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Descripción (opcional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Precio base *</label>
              <Input type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Costo base *</label>
              <Input type="number" min="0" step="0.01" value={baseCost} onChange={(e) => setBaseCost(e.target.value)} required />
            </div>
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Guardando…" : product ? "Guardar cambios" : "Crear producto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: `components/products/VariantFormDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { createVariant, updateVariant, type ProductVariant } from "@/app/actions/products"

interface Props {
  productId: string
  variant?: ProductVariant
  trigger: React.ReactNode
}

export default function VariantFormDialog({ productId, variant, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(variant?.name ?? "")
  const [sku, setSku] = useState(variant?.sku ?? "")
  const [price, setPrice] = useState(variant?.price != null ? String(variant.price) : "")
  const [costPrice, setCostPrice] = useState(variant?.cost_price != null ? String(variant.cost_price) : "")
  const [stock, setStock] = useState(variant ? String(variant.stock) : "0")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = variant
      ? await updateVariant(variant.id, {
          name,
          sku: sku.trim() || null,
          price: price.trim() === "" ? null : Number(price),
          costPrice: costPrice.trim() === "" ? null : Number(costPrice),
        })
      : await createVariant(productId, {
          name,
          sku: sku.trim() || null,
          price: price.trim() === "" ? null : Number(price),
          costPrice: costPrice.trim() === "" ? null : Number(costPrice),
          stock: Number(stock),
        })

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{variant ? "Editar variante" : "Nueva variante"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Nombre *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder='ej. "500ml", "Talle M", "Única"' />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">SKU (opcional)</label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Precio (vacío = precio base)</label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Costo (vacío = costo base)</label>
              <Input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
            </div>
          </div>
          {!variant && (
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Stock inicial</label>
              <Input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
            </div>
          )}
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Guardando…" : variant ? "Guardar cambios" : "Crear variante"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: `components/products/RestockDialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Alert } from "@/components/ui/alert"
import { restockVariant } from "@/app/actions/products"

interface Props {
  variantId: string
  variantName: string
  trigger: React.ReactNode
}

export default function RestockDialog({ variantId, variantName, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState("")
  const [newCost, setNewCost] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await restockVariant(
      variantId,
      Number(quantity),
      newCost.trim() === "" ? null : Number(newCost)
    )

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      setOpen(false)
      setQuantity("")
      setNewCost("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reponer stock — {variantName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Cantidad a sumar *</label>
            <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm text-muted-foreground">Costo nuevo (opcional, si cambió)</label>
            <Input type="number" min="0" step="0.01" value={newCost} onChange={(e) => setNewCost(e.target.value)} />
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Reponiendo…" : "Reponer stock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: `components/products/ProductCatalogPanel.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Plus, PackagePlus, Pencil, EyeOff, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert } from "@/components/ui/alert"
import { toggleProductActive, toggleVariantActive, type Product } from "@/app/actions/products"
import ProductFormDialog from "./ProductFormDialog"
import VariantFormDialog from "./VariantFormDialog"
import RestockDialog from "./RestockDialog"

const CATEGORY_LABELS: Record<string, string> = {
  bebidas: "Bebidas",
  suplementos: "Suplementos",
  indumentaria: "Indumentaria",
  accesorios: "Accesorios",
  otro: "Otro",
}

export default function ProductCatalogPanel({ products, isAdmin }: { products: Product[]; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)

  async function handleToggleProduct(productId: string, nextActive: boolean) {
    setBusyId(productId)
    setToggleError(null)
    const result = await toggleProductActive(productId, nextActive)
    setBusyId(null)
    if (result.error) setToggleError(result.error)
  }

  async function handleToggleVariant(variantId: string, nextActive: boolean) {
    setBusyId(variantId)
    setToggleError(null)
    const result = await toggleVariantActive(variantId, nextActive)
    setBusyId(null)
    if (result.error) setToggleError(result.error)
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Todavía no hay productos cargados{isAdmin ? " — creá el primero." : "."}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <ProductFormDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Nuevo producto
              </Button>
            }
          />
        </div>
      )}

      {products.map((product) => (
        <div key={product.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <button
            onClick={() => setExpanded(expanded === product.id ? null : product.id)}
            className="flex w-full items-center justify-between text-left"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_LABELS[product.category]} · ${Number(product.base_price).toLocaleString("es-AR")}
                {!product.is_active && " · Desactivado"}
              </p>
            </div>
          </button>

          {expanded === product.id && (
            <div className="space-y-2 border-t border-border pt-3">
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <ProductFormDialog
                    product={product}
                    trigger={<Button size="sm" variant="outline"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar producto</Button>}
                  />
                  <VariantFormDialog
                    productId={product.id}
                    trigger={<Button size="sm" variant="outline"><PackagePlus className="mr-1.5 h-3.5 w-3.5" />Nueva variante</Button>}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === product.id}
                    onClick={() => handleToggleProduct(product.id, !product.is_active)}
                  >
                    {product.is_active
                      ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Desactivar</>
                      : <><Eye className="mr-1.5 h-3.5 w-3.5" />Reactivar</>}
                  </Button>
                </div>
              )}

              <div className="space-y-1.5">
                {product.product_variants.map((variant) => (
                  <div key={variant.id} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2">
                    <div>
                      <p className="text-sm text-foreground">{variant.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stock: {variant.stock}
                        {!variant.is_active && " · Desactivada"}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1.5">
                        <RestockDialog
                          variantId={variant.id}
                          variantName={variant.name}
                          trigger={<Button size="sm" variant="ghost">Reponer</Button>}
                        />
                        <VariantFormDialog
                          productId={product.id}
                          variant={variant}
                          trigger={<Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === variant.id}
                          onClick={() => handleToggleVariant(variant.id, !variant.is_active)}
                        >
                          {variant.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {toggleError && <Alert variant="error">{toggleError}</Alert>}
    </div>
  )
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add components/products/ProductFormDialog.tsx components/products/VariantFormDialog.tsx components/products/RestockDialog.tsx components/products/ProductCatalogPanel.tsx
git commit -m "feat(productos): UI de catalogo (crear/editar/desactivar producto y variante, reponer stock)"
```

---

### Task 7: `components/products/SellProductPanel.tsx` — pestaña Vender

**Files:**
- Create: `components/products/SellProductPanel.tsx`

**Interfaces:**
- Consumes: `Product`, `recordSale` (`@/app/actions/products`); `resolveVariantPrice`, `calculateSaleTotal` (`@/lib/products`).
- Produces: `SellProductPanel({ products, members }: { products: Product[]; members: { id: string; full_name: string | null }[] })`. Task 10 lo monta en la pestaña "Vender".

- [ ] **Step 1: Escribir el componente**

```tsx
"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert } from "@/components/ui/alert"
import { recordSale, type Product } from "@/app/actions/products"
import { resolveVariantPrice, calculateSaleTotal } from "@/lib/products"

type Member = { id: string; full_name: string | null }

interface FlatVariant {
  variantId: string
  productId: string
  label: string // "Whey Protein — 1kg"
  price: number
  stock: number
}

export default function SellProductPanel({ products, members }: { products: Product[]; members: Member[] }) {
  const flatVariants = useMemo<FlatVariant[]>(() => {
    const result: FlatVariant[] = []
    for (const product of products) {
      if (!product.is_active) continue
      for (const variant of product.product_variants) {
        if (!variant.is_active) continue
        result.push({
          variantId: variant.id,
          productId: product.id,
          label: `${product.name} — ${variant.name}`,
          price: resolveVariantPrice(product, variant),
          stock: variant.stock,
        })
      }
    }
    return result
  }, [products])

  const [variantId, setVariantId] = useState(flatVariants[0]?.variantId ?? "")
  const [quantity, setQuantity] = useState("1")
  const [memberId, setMemberId] = useState("")
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; msg: string } | null>(null)

  const selected = flatVariants.find(v => v.variantId === variantId) ?? null
  const total = selected ? calculateSaleTotal(selected.price, Number(quantity) || 0) : 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setLoading(true)
    setFeedback(null)

    const result = await recordSale(selected.variantId, Number(quantity), memberId || null)

    setLoading(false)
    if (result.error) {
      setFeedback({ kind: "error", msg: result.error })
    } else {
      setFeedback({ kind: "success", msg: "Venta registrada" })
      setQuantity("1")
      setMemberId("")
    }
  }

  if (flatVariants.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay productos con stock disponibles para vender.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Producto *</label>
          <select
            required
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          >
            {flatVariants.map((v) => (
              <option key={v.variantId} value={v.variantId}>
                {v.label} — ${v.price.toLocaleString("es-AR")} (stock: {v.stock})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Cantidad *</label>
          <Input type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm text-muted-foreground">Socio (opcional)</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2.5 text-sm text-foreground focus:border-brand-500/50 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
          >
            <option value="">Sin socio</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name ?? "Sin nombre"}</option>
            ))}
          </select>
        </div>

        {feedback && <Alert variant={feedback.kind === "success" ? "success" : "error"}>{feedback.msg}</Alert>}

        <Button type="submit" disabled={loading || !selected} className="w-full">
          {loading ? "Vendiendo…" : `Vender — $${total.toLocaleString("es-AR")}`}
        </Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/products/SellProductPanel.tsx
git commit -m "feat(productos): UI de venta en efectivo"
```

---

### Task 8: `components/products/ProductSalesPanel.tsx` — pestaña Ventas

**Files:**
- Create: `components/products/ProductSalesPanel.tsx`

**Interfaces:**
- Consumes: `ProductSaleRow` (`@/app/actions/products`); `formatInstantAR` (`@/lib/date-ar`).
- Produces: `ProductSalesPanel({ sales }: { sales: ProductSaleRow[] })`. Task 10 lo monta en la pestaña "Ventas".

- [ ] **Step 1: Escribir el componente**

```tsx
"use client"

import type { ProductSaleRow } from "@/app/actions/products"
import { formatInstantAR } from "@/lib/date-ar"

function formatARS(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ProductSalesPanel({ sales }: { sales: ProductSaleRow[] }) {
  if (sales.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Todavía no hay ventas registradas.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">Fecha</th>
            <th className="px-4 py-3 font-medium">Producto</th>
            <th className="px-4 py-3 font-medium">Cantidad</th>
            <th className="px-4 py-3 font-medium">Monto</th>
            <th className="px-4 py-3 font-medium">Socio</th>
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-muted-foreground">{formatInstantAR(sale.created_at)}</td>
              <td className="px-4 py-3 text-foreground">
                {sale.product_variants
                  ? `${sale.product_variants.products?.name ?? "—"} — ${sale.product_variants.name}`
                  : "—"}
              </td>
              <td className="px-4 py-3 text-foreground">{sale.quantity}</td>
              <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                {formatARS(sale.total_amount)}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{sale.profiles?.full_name ?? "Sin socio"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 3: Commit**

```bash
git add components/products/ProductSalesPanel.tsx
git commit -m "feat(productos): UI de historial de ventas"
```

---

### Task 9: Página `/productos` + ítem de navegación

**Files:**
- Create: `app/(dashboard)/productos/page.tsx`
- Modify: `components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `getProducts`, `getProductSales` (`@/app/actions/products`); `ProductCatalogPanel` (Task 6), `SellProductPanel` (Task 7), `ProductSalesPanel` (Task 8); `TabSwitcher` (`@/components/ui/TabSwitcher`, ya existente); `canCollectPayment` (`@/lib/payments`).

- [ ] **Step 1: Agregar el ítem de navegación**

En `components/layout/Sidebar.tsx`, agregar `ShoppingBag` al import de `lucide-react` (junto a `Apple`, `BarChart2`, etc.) y agregar una fila a `NAV_ITEMS`, inmediatamente después de la de Nutrición:

```ts
{ href: "/nutricion", label: "Nutrición", icon: Apple },
{ href: "/productos", label: "Productos", icon: ShoppingBag, staffOnly: true },
```

- [ ] **Step 2: Escribir la página**

```tsx
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import TabSwitcher from "@/components/ui/TabSwitcher"
import { getProducts, getProductSales } from "@/app/actions/products"
import { canCollectPayment } from "@/lib/payments"
import ProductCatalogPanel from "@/components/products/ProductCatalogPanel"
import SellProductPanel from "@/components/products/SellProductPanel"
import ProductSalesPanel from "@/components/products/ProductSalesPanel"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Productos" }

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from("profiles")
    .select("gym_id, role, can_collect_payments")
    .eq("id", user!.id)
    .single()

  const profile = profileData as { gym_id: string | null; role: string; can_collect_payments: boolean } | null
  if (!profile || profile.role === "member") redirect("/dashboard")

  const isAdmin = profile.role === "admin"
  const canSell = canCollectPayment(profile.role, profile.can_collect_payments === true)

  const tabs = [
    { key: "catalogo", label: "Catálogo" },
    ...(canSell ? [{ key: "vender", label: "Vender" }] : []),
    ...(isAdmin ? [{ key: "ventas", label: "Ventas" }] : []),
  ]
  const requestedTab = searchParams.tab ?? "catalogo"
  const tab = tabs.some(t => t.key === requestedTab) ? requestedTab : "catalogo"

  let content: React.ReactNode

  if (tab === "vender" && canSell) {
    const productsResult = await getProducts()
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("gym_id", profile.gym_id ?? "")
      .eq("role", "member")
      .order("full_name") as unknown as { data: { id: string; full_name: string | null }[] | null }

    content = "products" in productsResult
      ? <SellProductPanel products={productsResult.products} members={members ?? []} />
      : <p className="text-sm text-red-500">{productsResult.error}</p>
  } else if (tab === "ventas" && isAdmin) {
    const salesResult = await getProductSales()
    content = "sales" in salesResult
      ? <ProductSalesPanel sales={salesResult.sales} />
      : <p className="text-sm text-red-500">{salesResult.error}</p>
  } else {
    const productsResult = await getProducts(true)
    content = "products" in productsResult
      ? <ProductCatalogPanel products={productsResult.products} isAdmin={isAdmin} />
      : <p className="text-sm text-red-500">{productsResult.error}</p>
  }

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="font-heading text-3xl font-normal tracking-wide text-foreground">Productos</h1>
        <p className="text-muted-foreground">Catálogo, stock y ventas del mostrador</p>
      </div>
      <TabSwitcher tabs={tabs} activeTab={tab} />
      {content}
    </div>
  )
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add app/\(dashboard\)/productos/page.tsx components/layout/Sidebar.tsx
git commit -m "feat(productos): pagina /productos con tabs catalogo, vender y ventas"
```

---

## Verificación final

Después de la Task 9:

1. `npx vitest run lib/products.test.ts app/actions/products.test.ts` — todos los tests en verde (35 tests: 9 de Task 3 + 26 de Task 4/5).
2. `npx tsc --noEmit` — sin errores en todo el proyecto.
3. Revisar manualmente en el navegador (`npm run dev`, nunca `npm run build`): entrar como admin, crear un producto con una variante, reponer stock, vender en efectivo (con y sin socio), y confirmar que aparece en "Ventas". Entrar como trainer sin `can_collect_payments` y confirmar que no ve la pestaña "Vender" ni "Ventas", pero sí "Catálogo" en modo solo lectura.
