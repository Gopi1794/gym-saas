-- Harden grants for product catalog tables.
-- RLS keeps tenant/role authorization; grants remove anon access and keep only
-- authenticated operations needed by admin/staff server actions.

revoke all on table public.products from anon;
revoke all on table public.product_variants from anon;

revoke all on table public.products from authenticated;
revoke all on table public.product_variants from authenticated;

-- Staff reads and admin writes remain constrained by existing RLS policies.
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.product_variants to authenticated;

grant all on table public.products to service_role;
grant all on table public.product_variants to service_role;
