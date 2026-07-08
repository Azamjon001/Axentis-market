-- Broadcast chat: a single shared channel where the admin panel is the owner
-- and every company is a member. Companies and the admin post text / image /
-- voice / link messages; the admin can edit & delete any message and ban a
-- company from posting. Additive — new tables only.

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS broadcast_messages (
    id                BIGSERIAL PRIMARY KEY,
    sender_type       VARCHAR(10) NOT NULL DEFAULT 'company',
    sender_company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
    sender_name       VARCHAR(150) NOT NULL DEFAULT '',
    type              VARCHAR(10) NOT NULL DEFAULT 'text',
    content           TEXT NOT NULL DEFAULT '',
    media_url         TEXT,
    edited            BOOLEAN NOT NULL DEFAULT FALSE,
    edited_at         TIMESTAMPTZ,
    deleted           BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_messages skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS idx_broadcast_messages_id ON broadcast_messages(id);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'idx_broadcast_messages_id skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  -- banned_until NULL = бан навсегда; запись присутствует => компания забанена.
  CREATE TABLE IF NOT EXISTS broadcast_bans (
    company_id   BIGINT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    banned_until TIMESTAMPTZ,
    reason       TEXT DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'broadcast_bans skipped: %', SQLERRM;
END $$;
