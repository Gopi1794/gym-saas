-- ============================================================
-- Nutrition Plans Feature
-- ============================================================

-- Food library (gym_id NULL = global defaults visible to all gyms)
CREATE TABLE foods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID REFERENCES gyms(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  calories      NUMERIC(8,2) NOT NULL DEFAULT 0,  -- per 100g
  protein       NUMERIC(8,2) NOT NULL DEFAULT 0,  -- per 100g
  carbs         NUMERIC(8,2) NOT NULL DEFAULT 0,  -- per 100g
  fat           NUMERIC(8,2) NOT NULL DEFAULT 0,  -- per 100g
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Nutrition plans assigned to members
CREATE TABLE nutrition_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id        UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  goal          TEXT CHECK (goal IN ('volumen', 'definicion', 'mantenimiento', 'otro')) DEFAULT 'mantenimiento',
  notes         TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Meals within a plan (Desayuno, Almuerzo, etc.)
CREATE TABLE nutrition_meals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  time_label    TEXT,          -- "08:00", "13:00", optional
  order_index   INTEGER NOT NULL DEFAULT 0
);

-- Food items within a meal
CREATE TABLE nutrition_meal_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id       UUID NOT NULL REFERENCES nutrition_meals(id) ON DELETE CASCADE,
  food_id       UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  quantity_grams NUMERIC(8,2) NOT NULL DEFAULT 100
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX ON nutrition_plans(gym_id);
CREATE INDEX ON nutrition_plans(member_id);
CREATE INDEX ON nutrition_meals(plan_id);
CREATE INDEX ON nutrition_meal_items(meal_id);
CREATE INDEX ON foods(gym_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE foods               ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_meals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_meal_items ENABLE ROW LEVEL SECURITY;

-- Foods: readable by authenticated users of the gym (global + gym-specific)
CREATE POLICY "foods_read" ON foods FOR SELECT
  USING (
    gym_id IS NULL OR
    gym_id IN (SELECT gym_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "foods_write" ON foods FOR ALL
  USING (
    gym_id IN (
      SELECT gym_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'trainer')
    )
  );

-- Nutrition plans: admin/trainer manage, member reads own
CREATE POLICY "nutrition_plans_read" ON nutrition_plans FOR SELECT
  USING (
    gym_id IN (SELECT gym_id FROM profiles WHERE id = auth.uid())
    AND (
      member_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
    )
  );

CREATE POLICY "nutrition_plans_write" ON nutrition_plans FOR ALL
  USING (
    gym_id IN (
      SELECT gym_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'trainer')
    )
  );

-- Meals: same access as the parent plan
CREATE POLICY "nutrition_meals_read" ON nutrition_meals FOR SELECT
  USING (
    plan_id IN (SELECT id FROM nutrition_plans)
  );

CREATE POLICY "nutrition_meals_write" ON nutrition_meals FOR ALL
  USING (
    plan_id IN (
      SELECT np.id FROM nutrition_plans np
      JOIN profiles p ON p.gym_id = np.gym_id
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'trainer')
    )
  );

-- Meal items: same access chain
CREATE POLICY "nutrition_meal_items_read" ON nutrition_meal_items FOR SELECT
  USING (
    meal_id IN (SELECT id FROM nutrition_meals)
  );

CREATE POLICY "nutrition_meal_items_write" ON nutrition_meal_items FOR ALL
  USING (
    meal_id IN (
      SELECT nm.id FROM nutrition_meals nm
      JOIN nutrition_plans np ON np.id = nm.plan_id
      JOIN profiles p ON p.gym_id = np.gym_id
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'trainer')
    )
  );

-- ── Seed: alimentos argentinos comunes (globales, gym_id NULL) ──
INSERT INTO foods (gym_id, name, calories, protein, carbs, fat) VALUES
  -- Proteínas
  (NULL, 'Pechuga de pollo cocida',    165,  31.0,  0.0,  3.6),
  (NULL, 'Muslo de pollo cocido',      209,  26.0,  0.0, 11.0),
  (NULL, 'Carne vacuna magra (nalga)', 140,  22.0,  0.0,  5.0),
  (NULL, 'Carne vacuna (asado)',       291,  17.0,  0.0, 25.0),
  (NULL, 'Milanesa de ternera',        230,  22.0, 12.0,  9.0),
  (NULL, 'Salmón',                     208,  20.0,  0.0, 13.0),
  (NULL, 'Atún en agua (escurrido)',   116,  26.0,  0.0,  1.0),
  (NULL, 'Huevo entero',               155,  13.0,  1.1, 11.0),
  (NULL, 'Clara de huevo',              52,  11.0,  0.7,  0.2),
  (NULL, 'Proteína whey (polvo)',      380,  80.0,  5.0,  5.0),
  (NULL, 'Yogur griego natural',        59,  10.0,  3.6,  0.4),
  (NULL, 'Queso cottage',               98,  11.0,  3.4,  4.3),
  -- Carbohidratos
  (NULL, 'Arroz blanco cocido',        130,   2.7, 28.0,  0.3),
  (NULL, 'Arroz integral cocido',      123,   2.6, 25.6,  1.0),
  (NULL, 'Avena (seca)',               389,  17.0, 66.0,  7.0),
  (NULL, 'Papa cocida',                 87,   1.9, 20.0,  0.1),
  (NULL, 'Batata cocida',               90,   2.0, 21.0,  0.1),
  (NULL, 'Pasta cocida',               158,   5.8, 31.0,  0.9),
  (NULL, 'Pan integral',               247,  13.0, 41.0,  4.2),
  (NULL, 'Pan blanco',                 265,   9.0, 49.0,  3.2),
  (NULL, 'Banana',                      89,   1.1, 23.0,  0.3),
  (NULL, 'Manzana',                     52,   0.3, 14.0,  0.2),
  (NULL, 'Naranja',                     47,   0.9, 12.0,  0.1),
  (NULL, 'Mandarina',                   53,   0.8, 13.0,  0.3),
  (NULL, 'Frutillas',                   32,   0.7,  7.7,  0.3),
  (NULL, 'Mango',                       60,   0.8, 15.0,  0.4),
  -- Grasas
  (NULL, 'Aceite de oliva',            884,   0.0,  0.0,100.0),
  (NULL, 'Palta / Aguacate',           160,   2.0,  9.0, 15.0),
  (NULL, 'Almendras',                  579,  21.0, 22.0, 50.0),
  (NULL, 'Maní',                       567,  26.0, 16.0, 49.0),
  (NULL, 'Manteca de maní',            588,  25.0, 20.0, 50.0),
  (NULL, 'Nueces',                     654,  15.0, 14.0, 65.0),
  -- Lácteos
  (NULL, 'Leche entera',                61,   3.2,  4.8,  3.3),
  (NULL, 'Leche descremada',            35,   3.4,  5.0,  0.1),
  (NULL, 'Queso port salut',           290,  23.0,  0.0, 22.0),
  (NULL, 'Queso cremoso',              260,  15.0,  2.0, 22.0),
  -- Verduras
  (NULL, 'Brócoli',                     34,   2.8,  7.0,  0.4),
  (NULL, 'Espinaca',                    23,   2.9,  3.6,  0.4),
  (NULL, 'Lechuga',                     15,   1.4,  2.9,  0.2),
  (NULL, 'Tomate',                      18,   0.9,  3.9,  0.2),
  (NULL, 'Zanahoria',                   41,   0.9, 10.0,  0.2),
  (NULL, 'Pepino',                      16,   0.7,  3.6,  0.1),
  (NULL, 'Zucchini',                    17,   1.2,  3.1,  0.3),
  (NULL, 'Espárragos',                  20,   2.2,  3.9,  0.1),
  -- Otros
  (NULL, 'Cacao amargo en polvo',      228,  20.0, 57.0, 14.0),
  (NULL, 'Miel',                       304,   0.3, 82.0,  0.0),
  (NULL, 'Aceite de coco',             862,   0.0,  0.0,100.0),
  (NULL, 'Granola',                    471,  10.0, 64.0, 20.0);
