-- Product reports group paid sales by collection timestamp, scoped to each gym.
-- The partial predicate keeps the index small and matches the report's paid-only query.
create index if not exists product_orders_gym_paid_at_idx
  on public.product_orders (gym_id, paid_at desc)
  where status = 'paid' and paid_at is not null;
