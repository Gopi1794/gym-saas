ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS sugars        decimal(8,2),
  ADD COLUMN IF NOT EXISTS saturated_fat decimal(8,2),
  ADD COLUMN IF NOT EXISTS potassium     decimal(8,2),
  ADD COLUMN IF NOT EXISTS calcium       decimal(8,2),
  ADD COLUMN IF NOT EXISTS magnesium     decimal(8,2),
  ADD COLUMN IF NOT EXISTS zinc          decimal(8,3),
  ADD COLUMN IF NOT EXISTS iron          decimal(8,3),
  ADD COLUMN IF NOT EXISTS vitamin_b12   decimal(8,3);
