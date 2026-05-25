alter table profiles
  add column if not exists onboarding_seen boolean not null default false;
