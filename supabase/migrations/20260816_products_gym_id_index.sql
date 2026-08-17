-- Cada listado de productos filtra por gym_id (getProducts en
-- app/actions/products.ts) — falta el índice que lo respalda.
create index products_gym_id_idx on products(gym_id);
