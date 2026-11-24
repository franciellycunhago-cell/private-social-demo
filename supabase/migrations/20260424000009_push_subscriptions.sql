-- =============================================================================
-- Push Subscriptions — armazena endpoints Web Push por usuário
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint    text NOT NULL,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Cada user gerencia apenas suas próprias subscriptions
CREATE POLICY "push_select_own"
  ON push_subscriptions FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "push_insert_own"
  ON push_subscriptions FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "push_delete_own"
  ON push_subscriptions FOR DELETE
  USING (profile_id = auth.uid());
