-- Admin-uploaded short decoration videos. The admin uploads small looping clips
-- which every company can pick as an animated background for its store page.

DO $$
BEGIN
  CREATE TABLE IF NOT EXISTS decoration_videos (
    id         BIGSERIAL PRIMARY KEY,
    title      VARCHAR(200) NOT NULL DEFAULT '',
    url        TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'decoration_videos table skipped: %', SQLERRM;
END $$;
