alter table profiles
  add column if not exists trainer_id uuid references profiles(id) on delete set null;

create index if not exists profiles_trainer_id_idx on profiles(trainer_id);
