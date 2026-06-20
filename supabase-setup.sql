-- Run this in your Supabase project → SQL Editor

CREATE TABLE IF NOT EXISTS proofs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token           text UNIQUE NOT NULL,
  customer_name   text NOT NULL,
  customer_email  text NOT NULL,
  customer_phone  text,
  mockup_urls     text[]   DEFAULT '{}',
  pricing_items   jsonb    DEFAULT '[]',
  deposit_amount  numeric(10,2),
  order_notes     text,
  policy_text     text,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  approved_at     timestamptz,
  approved_by_name text,
  approved_ip     text,
  created_at      timestamptz DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS proofs_token_idx ON proofs (token);

-- Storage bucket: create manually in Supabase Dashboard → Storage
-- Bucket name: proof-mockups
-- Set bucket to PUBLIC so images are accessible via URL
