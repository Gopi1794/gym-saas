-- Harden grants for product commerce tables.
-- RLS remains the authorization layer, but table privileges should still be least-privilege.

revoke all on table public.product_orders from anon;
revoke all on table public.product_order_items from anon;
revoke all on table public.product_stock_movements from anon;
revoke all on table public.product_promotions from anon;

revoke all on table public.product_orders from authenticated;
revoke all on table public.product_order_items from authenticated;
revoke all on table public.product_stock_movements from authenticated;
revoke all on table public.product_promotions from authenticated;

-- Admin/staff reads are still constrained by RLS policies.
grant select on table public.product_orders to authenticated;
grant select on table public.product_order_items to authenticated;
grant select on table public.product_stock_movements to authenticated;

-- Promotion management uses authenticated server actions plus admin-only RLS policies.
-- Members can only SELECT active member-safe promotion rows through RLS.
grant select, insert, update, delete on table public.product_promotions to authenticated;

grant all on table public.product_orders to service_role;
grant all on table public.product_order_items to service_role;
grant all on table public.product_stock_movements to service_role;
grant all on table public.product_promotions to service_role;
