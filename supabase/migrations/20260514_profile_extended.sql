-- Extended profile fields for gym intake form
alter table profiles
  add column if not exists date_of_birth        date,
  add column if not exists phone                text,
  add column if not exists weight_kg            numeric(5,2),
  add column if not exists height_cm            integer,
  add column if not exists goal                 text check (goal in ('lose_weight','gain_muscle','performance','maintain')),
  add column if not exists medical_conditions   text,
  add column if not exists training_frequency   text check (training_frequency in ('never','1-2','3-4','5+')),
  add column if not exists emergency_name       text,
  add column if not exists emergency_phone      text;
