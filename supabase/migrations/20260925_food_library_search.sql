-- Food library: accent-insensitive search, server-side pagination and category
-- facets in a single round trip. SECURITY INVOKER keeps RLS in force
-- (foods_read: global rows or rows of the caller's gym); p_gym_id only narrows.
create extension if not exists unaccent with schema extensions;

create or replace function public.search_foods(
  p_gym_id uuid,
  p_query text default null,
  p_categories text[] default null,
  p_include_uncategorized boolean default false,
  p_scope text default 'all',
  p_limit integer default 24,
  p_offset integer default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select case
      when nullif(btrim(p_query), '') is null then null
      else replace(replace(replace(extensions.unaccent(lower(btrim(p_query))), '\', '\\'), '%', '\%'), '_', '\_')
    end as pattern
  ),
  base as (
    select f.*
    from public.foods f, q
    where (f.gym_id is null or f.gym_id = p_gym_id)
      and (
        q.pattern is null
        or extensions.unaccent(lower(concat_ws(' ', f.name, f.category, f.subcategory, f.scientific_name)))
           like '%' || q.pattern || '%' escape '\'
      )
  ),
  filtered as (
    select b.*
    from base b
    where (p_scope <> 'mine' or b.gym_id = p_gym_id)
      and (
        (p_categories is null and not p_include_uncategorized)
        or b.category = any(p_categories)
        or (p_include_uncategorized and b.category is null)
      )
  ),
  page as (
    select *
    from filtered
    order by lower(name), id
    limit least(greatest(p_limit, 0), 100)
    offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', coalesce((select jsonb_agg(to_jsonb(p) order by lower(p.name), p.id) from page p), '[]'::jsonb),
    'facets', jsonb_build_object(
      'all', (select count(*) from base),
      'mine', (select count(*) from base where gym_id = p_gym_id),
      'uncategorized', (select count(*) from base where category is null),
      'categories', coalesce(
        (
          select jsonb_object_agg(c.category, c.n)
          from (select category, count(*) as n from base where category is not null group by category) c
        ),
        '{}'::jsonb
      )
    )
  )
$$;

revoke all on function public.search_foods(uuid, text, text[], boolean, text, integer, integer) from public, anon;
grant execute on function public.search_foods(uuid, text, text[], boolean, text, integer, integer) to authenticated;
