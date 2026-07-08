-- Admin credentials stored in the database.
--
-- Single-row table (id is pinned to 1). When a row exists, the platform admin
-- login (POST /auth/login/admin) validates against it. When the table is empty
-- the login falls back to ADMIN_PHONE / ADMIN_CODE from the environment, so the
-- existing credentials keep working until the admin sets a new password from the
-- admin panel (Security section). After the first change the password lives only
-- in this table (bcrypt-hashed).
CREATE TABLE IF NOT EXISTS admin_credentials (
    id            INTEGER PRIMARY KEY DEFAULT 1,
    phone         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT admin_credentials_singleton CHECK (id = 1)
);
