-- Categorize the original global manual foods with the same vocabulary as the
-- ARGENFOODS catalog so they appear under the same category chips. Only rows
-- without a category are touched, so re-running is a no-op. Gym-owned foods and
-- catalog rows are left as they are.
update public.foods f
set category = v.category,
    subcategory = v.subcategory
from (values
  ('Aceite de coco',             'Grasas y aceites',               'Grasas y aceites'),
  ('Aceite de oliva',            'Grasas y aceites',               'Grasas y aceites'),
  ('Almendras',                  'Vegetales y derivados',          'Vegetales y derivados'),
  ('Arroz blanco cocido',        'Cereales y derivados',           'Cereales y derivados'),
  ('Arroz integral cocido',      'Cereales y derivados',           'Cereales y derivados'),
  ('Atún en agua (escurrido)',   'Pescados, mariscos y conservas', 'Conservas'),
  ('Avena (seca)',               'Cereales y derivados',           'Cereales y derivados'),
  ('Banana',                     'Frutas y derivados',             'Frutas y derivados'),
  ('Batata cocida',              'Vegetales y derivados',          'Vegetales y derivados'),
  ('Brócoli',                    'Vegetales y derivados',          'Vegetales y derivados'),
  ('Cacao amargo en polvo',      'Misceláneos',                    'Misceláneas'),
  ('Carne vacuna (asado)',       'Carnes y derivados',             'Vacuno'),
  ('Carne vacuna magra (nalga)', 'Carnes y derivados',             'Vacuno'),
  ('Clara de huevo',             'Huevos y derivados',             'Huevos y derivados'),
  ('Espárragos',                 'Vegetales y derivados',          'Vegetales y derivados'),
  ('Espinaca',                   'Vegetales y derivados',          'Vegetales y derivados'),
  ('Frutillas',                  'Frutas y derivados',             'Frutas y derivados'),
  ('Granola',                    'Cereales y derivados',           'Cereales y derivados'),
  ('Huevo entero',               'Huevos y derivados',             'Huevos y derivados'),
  ('Leche descremada',           'Leche y derivados',              'Leche'),
  ('Leche entera',               'Leche y derivados',              'Leche'),
  ('Lechuga',                    'Vegetales y derivados',          'Vegetales y derivados'),
  ('Mandarina',                  'Frutas y derivados',             'Frutas y derivados'),
  ('Mango',                      'Frutas y derivados',             'Frutas y derivados'),
  ('Maní',                       'Vegetales y derivados',          'Vegetales y derivados'),
  ('Manteca de maní',            'Vegetales y derivados',          'Vegetales y derivados'),
  ('Manzana',                    'Frutas y derivados',             'Frutas y derivados'),
  ('Miel',                       'Productos azucarados',           'Productos azucarados'),
  ('Milanesa de ternera',        'Carnes y derivados',             'Vacuno'),
  ('Muslo de pollo cocido',      'Carnes y derivados',             'Pollo'),
  ('Naranja',                    'Frutas y derivados',             'Frutas y derivados'),
  ('Nueces',                     'Vegetales y derivados',          'Vegetales y derivados'),
  ('Palta / Aguacate',           'Frutas y derivados',             'Frutas y derivados'),
  ('Pan blanco',                 'Cereales y derivados',           'Cereales y derivados'),
  ('Pan integral',               'Cereales y derivados',           'Cereales y derivados'),
  ('Papa cocida',                'Vegetales y derivados',          'Vegetales y derivados'),
  ('Pasta cocida',               'Cereales y derivados',           'Cereales y derivados'),
  ('Pechuga de pollo cocida',    'Carnes y derivados',             'Pollo'),
  ('Pepino',                     'Vegetales y derivados',          'Vegetales y derivados'),
  ('Proteína whey (polvo)',      'Misceláneos',                    'Misceláneas'),
  ('Queso cottage',              'Leche y derivados',              'Quesos blandos'),
  ('Queso cremoso',              'Leche y derivados',              'Quesos blandos'),
  ('Queso port salut',           'Leche y derivados',              'Quesos semiduros'),
  ('Salmón',                     'Pescados, mariscos y conservas', 'Pescados'),
  ('Tomate',                     'Vegetales y derivados',          'Vegetales y derivados'),
  ('Yogur griego natural',       'Leche y derivados',              'Yogur'),
  ('Zanahoria',                  'Vegetales y derivados',          'Vegetales y derivados'),
  ('Zucchini',                   'Vegetales y derivados',          'Vegetales y derivados')
) as v(name, category, subcategory)
where f.gym_id is null
  and f.source = 'manual'
  and f.category is null
  and f.name = v.name;
