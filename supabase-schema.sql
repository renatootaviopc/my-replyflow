-- ==========================================
-- MyReplyFlow - Database Schema
-- ==========================================

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Config table (single row)
CREATE TABLE IF NOT EXISTS config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  ig_user_id TEXT,
  username TEXT,
  name TEXT,
  profile_picture_url TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Automations table
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  triggers TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  match_type TEXT DEFAULT 'contains' CHECK (match_type IN ('contains', 'exact', 'any')),
  post_id TEXT,
  public_replies TEXT[] DEFAULT '{}',
  dm_welcome TEXT,
  quick_reply_button TEXT,
  link_url TEXT,
  link_label TEXT,
  reminder_text TEXT,
  reminder_delay_seconds INTEGER DEFAULT 3600,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Followups table (sequence of messages)
CREATE TABLE IF NOT EXISTS followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES automations(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL DEFAULT 1,
  delay_seconds INTEGER DEFAULT 0,
  message_text TEXT,
  has_link BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Contacts table
CREATE TABLE IF NOT EXISTS contacts (
  ig_user_id TEXT PRIMARY KEY,
  username TEXT,
  first_contact_at TIMESTAMPTZ DEFAULT now(),
  last_reply_at TIMESTAMPTZ,
  last_automation_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Queue table with atomic locking
CREATE TABLE IF NOT EXISTS queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  recipient_id TEXT NOT NULL,
  message_body JSONB NOT NULL,
  automation_id UUID REFERENCES automations(id),
  contact_id TEXT REFERENCES contacts(ig_user_id),
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  window_expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queue_status_pending ON queue(status, scheduled_at) WHERE status = 'pending';

-- Atomic claim function for queue
CREATE OR REPLACE FUNCTION claim_queue_items(p_limit INT DEFAULT 5)
RETURNS SETOF queue AS $$
  UPDATE queue
  SET status = 'sending', claimed_at = now()
  WHERE id IN (
    SELECT id FROM queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND (window_expires_at IS NULL OR window_expires_at > now())
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;

-- 6. Events table
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT DEFAULT 'webhook',
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, created_at DESC);

-- ==========================================
-- Enable RLS on all tables (no policies = server only)
-- ==========================================
ALTER TABLE config ENABLE ROW LEVEL SECURITY;
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- pg_cron jobs (configure AFTER deploying to Vercel)
-- ==========================================
-- Run these AFTER you have your Vercel URL and set the app.settings:
-- ALTER DATABASE SET "app.settings.app_url" = 'https://seu-app.vercel.app';
-- ALTER DATABASE SET "app.settings.worker_secret" = 'worker_secret_abc123_xyz789';
--
-- SELECT cron.schedule('drain-queue', '* * * * *', ...);
-- SELECT cron.schedule('renew-token', '0 3 * * 0', ...);
