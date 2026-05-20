alter table exercises add column if not exists external_id text unique;

create index if not exists exercises_external_id_idx on exercises (external_id);
