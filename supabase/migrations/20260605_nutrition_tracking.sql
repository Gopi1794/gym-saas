-- ============================================================
-- Nutrition Tracking — Phase 2
-- ============================================================

-- 1. Extend foods with fiber, sodium, household units
ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS fiber           NUMERIC(8,2) NOT NULL DEFAULT 0,   -- per 100g
  ADD COLUMN IF NOT EXISTS sodium          NUMERIC(8,2) NOT NULL DEFAULT 0,   -- mg per 100g
  ADD COLUMN IF NOT EXISTS household_unit  TEXT,           -- e.g. "1 huevo", "1 taza", "1 feta"
  ADD COLUMN IF NOT EXISTS grams_per_unit  NUMERIC(8,2);   -- e.g. 50, 150, 30

-- 2. Daily meal check-offs (did the member eat this meal today?)
CREATE TABLE IF NOT EXISTS nutrition_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  meal_id     UUID NOT NULL REFERENCES nutrition_meals(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, meal_id, log_date)
);

CREATE INDEX IF NOT EXISTS nutrition_logs_member_date ON nutrition_logs(member_id, log_date);

-- 3. Daily water intake
CREATE TABLE IF NOT EXISTS water_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  glasses     INTEGER NOT NULL DEFAULT 0,
  UNIQUE (member_id, log_date)
);

CREATE INDEX IF NOT EXISTS water_logs_member_date ON water_logs(member_id, log_date);

-- 4. Periodic weight measurements
CREATE TABLE IF NOT EXISTS weight_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg   NUMERIC(5,2) NOT NULL,
  notes       TEXT,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS weight_logs_member_date ON weight_logs(member_id, log_date);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs    ENABLE ROW LEVEL SECURITY;

-- nutrition_logs: member reads/writes own; trainer reads gym members
CREATE POLICY "nutrition_logs_member" ON nutrition_logs FOR ALL
  USING (member_id = auth.uid());

CREATE POLICY "nutrition_logs_trainer_read" ON nutrition_logs FOR SELECT
  USING (
    member_id IN (
      SELECT p.id FROM profiles p
      JOIN profiles me ON me.gym_id = p.gym_id
      WHERE me.id = auth.uid() AND me.role IN ('admin', 'trainer')
    )
  );

-- water_logs: member only
CREATE POLICY "water_logs_member" ON water_logs FOR ALL
  USING (member_id = auth.uid());

-- weight_logs: member reads/writes own; trainer reads
CREATE POLICY "weight_logs_member" ON weight_logs FOR ALL
  USING (member_id = auth.uid());

CREATE POLICY "weight_logs_trainer_read" ON weight_logs FOR SELECT
  USING (
    member_id IN (
      SELECT p.id FROM profiles p
      JOIN profiles me ON me.gym_id = p.gym_id
      WHERE me.id = auth.uid() AND me.role IN ('admin', 'trainer')
    )
  );
