ALTER TABLE exercises ADD COLUMN is_timed boolean NOT NULL DEFAULT false;

UPDATE exercises SET is_timed = true WHERE name ILIKE '%plancha%';
UPDATE exercises SET is_timed = true WHERE name ILIKE '%puente isometrico%';
UPDATE exercises SET is_timed = true WHERE name ILIKE '%puente ranita%';
UPDATE exercises SET category = 'hiit', is_timed = true WHERE name ILIKE '%mountain climbers%' OR name ILIKE '%mountan climbers%';
