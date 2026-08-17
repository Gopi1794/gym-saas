-- Fail-closed en vez de fail-open: v_product.gym_id != p_gym_id evalúa a
-- NULL (no true) si p_gym_id llega NULL, así que el "not found or ..."
-- no dispara y el chequeo de tenant se saltea en silencio. No explotable
-- hoy (el middleware bloquea requests sin gym_id antes de llegar a un
-- Server Action, y product_sales.gym_id es NOT NULL así que el INSERT
-- fallaría igual) pero "is distinct from" es la forma correcta de
-- comparar cuando NULL es un valor posible a considerar.
create or replace function record_product_sale(
  p_variant_id  uuid,
  p_gym_id      uuid,
  p_member_id   uuid,
  p_quantity    integer,
  p_recorded_by uuid
)
returns uuid
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
  if not found or v_product.gym_id is distinct from p_gym_id then
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
