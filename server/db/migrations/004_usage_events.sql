-- Usage analytics event log
-- Tracks user actions (wizard steps, model runs, exports) tied to anonymous session IDs

CREATE TABLE IF NOT EXISTS usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL,                    -- anonymous client-side UUID
  event_type      VARCHAR(50) NOT NULL,             -- e.g. 'wizard_completed', 'model_run', 'pdf_export'
  event_data      JSONB,                            -- full fund config, wizard params, etc.
  lead_email      VARCHAR(200),                     -- populated when lead form submitted
  lead_org        VARCHAR(200),                     -- populated when lead form submitted
  lead_name       VARCHAR(200),                     -- populated when lead form submitted
  state           VARCHAR(5),                       -- denormalized for easy querying
  ip_address      VARCHAR(45),                      -- from request header
  user_agent      TEXT,                             -- browser info
  referrer        TEXT,                             -- HTTP referer
  utm_source      VARCHAR(100),
  utm_medium      VARCHAR(100),
  utm_campaign    VARCHAR(100),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_events(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_email ON usage_events(lead_email) WHERE lead_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_state ON usage_events(state) WHERE state IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_events(created_at);
