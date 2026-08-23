-- Fix product reservation cancellation to satisfy product_orders reserved_until invariant.
-- product_orders_check requires reserved_until only while status = 'reserved'.

create or replace function public.cancel_product_order(
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
  set status = 'cancelled',
      reserved_until = null,
      cancelled_at = now(),
      cancelled_by = p_cancelled_by,
      updated_at = now()
  where id = p_order_id;

  return p_order_id;
end;
$$;

revoke all on function public.cancel_product_order(uuid, uuid, uuid, text) from public;
revoke all on function public.cancel_product_order(uuid, uuid, uuid, text) from anon;
revoke all on function public.cancel_product_order(uuid, uuid, uuid, text) from authenticated;
grant execute on function public.cancel_product_order(uuid, uuid, uuid, text) to service_role;
