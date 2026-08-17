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
