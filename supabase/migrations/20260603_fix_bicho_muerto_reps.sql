-- Bicho muerto es un ejercicio de fuerza con repeticiones, no de tiempo.
UPDATE exercises
SET is_timed = false
WHERE name = 'Bicho muerto';
