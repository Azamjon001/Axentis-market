-- Subscriptions table: user→company and user→user follows
CREATE TABLE IF NOT EXISTS subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    company_id BIGINT,
    subscribed_user_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_company
    ON subscriptions(user_id, company_id) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_target
    ON subscriptions(user_id, subscribed_user_id) WHERE subscribed_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Missing user columns
DO $$
DECLARE cols TEXT[] := ARRAY[
    'role VARCHAR(20) DEFAULT ''user''',
    'followers_count INTEGER DEFAULT 0',
    'following_count INTEGER DEFAULT 0',
    'profile_views INTEGER DEFAULT 0'
];
col TEXT; col_name TEXT;
BEGIN
    FOREACH col IN ARRAY cols LOOP
        col_name := split_part(col, ' ', 1);
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name=col_name) THEN
            EXECUTE 'ALTER TABLE users ADD COLUMN ' || col;
        END IF;
    END LOOP;
END $$;

-- Missing company columns
DO $$
DECLARE cols TEXT[] := ARRAY[
    'followers_count INTEGER DEFAULT 0',
    'is_enabled BOOLEAN DEFAULT TRUE',
    'delivery_enabled BOOLEAN DEFAULT FALSE',
    'delivery_radius NUMERIC(10,2) DEFAULT 5000',
    'private_code VARCHAR(50)',
    'referral_code VARCHAR(50)',
    'referral_agent_id BIGINT',
    'trial_started_at TIMESTAMPTZ',
    'trial_end_date TIMESTAMPTZ'
];
col TEXT; col_name TEXT;
BEGIN
    FOREACH col IN ARRAY cols LOOP
        col_name := split_part(col, ' ', 1);
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name=col_name) THEN
            EXECUTE 'ALTER TABLE companies ADD COLUMN ' || col;
        END IF;
    END LOOP;
END $$;
