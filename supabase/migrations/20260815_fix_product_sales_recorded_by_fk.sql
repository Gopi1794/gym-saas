-- Task 1 review found: recorded_by es NOT NULL pero su FK usaba
-- "on delete set null", una combinacion contradictoria que rompe con un
-- error de constraint la primera vez que se intente borrar un profile con
-- ventas registradas. Se corrige a "on delete restrict", mismo criterio ya
-- usado para variant_id en la misma tabla: una venta debe quedar pineada a
-- quien la registro, y borrar ese profile debe bloquearse, no intentar
-- poner null en una columna NOT NULL.
alter table product_sales
  drop constraint product_sales_recorded_by_fkey,
  add constraint product_sales_recorded_by_fkey
    foreign key (recorded_by) references profiles(id) on delete restrict;
