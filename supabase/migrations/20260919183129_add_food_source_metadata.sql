-- Track where global and gym-specific foods came from so external catalogs can
-- be imported idempotently without relying on display names.
alter table public.foods
  add column if not exists source text not null default 'manual',
  add column if not exists source_code text,
  add column if not exists category text,
  add column if not exists subcategory text,
  add column if not exists scientific_name text,
  add column if not exists data_quality text not null default 'complete',
  add column if not exists source_url text,
  add column if not exists source_updated_at date,
  add column if not exists cholesterol numeric(8,2),
  add column if not exists monounsaturated_fat numeric(8,2),
  add column if not exists polyunsaturated_fat numeric(8,2),
  add column if not exists trans_fat numeric(8,2),
  add column if not exists omega_3 numeric(8,3),
  add column if not exists omega_6 numeric(8,3),
  add column if not exists phosphorus numeric(8,2),
  add column if not exists vitamin_c numeric(8,3),
  add column if not exists thiamin numeric(8,3),
  add column if not exists riboflavin numeric(8,3),
  add column if not exists niacin numeric(8,3);

-- Missing secondary nutrients mean "not reported", not zero. Core macros stay
-- required because the planner needs them for every calculation.
alter table public.foods
  alter column fiber drop not null,
  alter column sodium drop not null;

alter table public.foods
  drop constraint if exists foods_data_quality_check;

alter table public.foods
  add constraint foods_data_quality_check
  check (data_quality in ('complete', 'trace_values', 'inferred_zero', 'incomplete'));

create unique index if not exists foods_global_source_code_uidx
  on public.foods (source, source_code)
  where gym_id is null and source_code is not null;

create index if not exists foods_source_category_idx
  on public.foods (source, category);
