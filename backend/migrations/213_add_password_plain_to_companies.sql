-- 213: Readable company password for the admin panel
-- ----------------------------------------------------------------------------
-- The admin panel needs to SHOW and EDIT the password a company uses to log in.
-- password_hash is upgraded to a bcrypt hash on the company's first login
-- (see auth.go), after which the original plaintext is unrecoverable. We keep a
-- separate password_plain column purely for admin display; login keeps using
-- password_hash, so security of the login flow is unchanged.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- Backfill: if the stored password_hash is still legacy plaintext (i.e. it is
-- NOT a bcrypt hash, which always starts with "$2"), copy it into
-- password_plain so existing companies become visible in the admin panel.
UPDATE companies
SET password_plain = password_hash
WHERE password_plain IS NULL
  AND password_hash IS NOT NULL
  AND password_hash <> ''
  AND password_hash NOT LIKE '$2%';
