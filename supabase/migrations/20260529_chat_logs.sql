-- Chat logs: almacena mensajes del asistente IA
-- Sirve para rate limiting (count recent rows) y auditoría

CREATE TABLE IF NOT EXISTS chat_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gym_id     uuid        REFERENCES gyms(id) ON DELETE SET NULL,
  role       text        NOT NULL CHECK (role IN ('user', 'assistant')),
  agent      text        NOT NULL DEFAULT 'fitness',
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice para consultas de rate limiting (user + fecha reciente)
CREATE INDEX IF NOT EXISTS chat_logs_user_created
  ON chat_logs (user_id, created_at DESC);

-- RLS
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Members only read their own logs
CREATE POLICY "chat_logs_select_own" ON chat_logs
  FOR SELECT USING (user_id = auth.uid());

-- Authenticated users can insert their own logs (server uses session client)
CREATE POLICY "chat_logs_insert_own" ON chat_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins of the same gym can read logs of their members
CREATE POLICY "chat_logs_admin_read" ON chat_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.gym_id = chat_logs.gym_id
    )
  );
