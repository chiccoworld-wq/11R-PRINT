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

-- ── CUSTOMER ORDERS (from the mockup builder on custom-order.html) ──
CREATE TABLE IF NOT EXISTS orders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name    text NOT NULL,
  customer_email   text,
  customer_phone   text,
  customer_company text,
  product          text,
  shirt_color      text,
  print_location   text,
  ink_colors       int,
  quantity         int,
  sizes            jsonb DEFAULT '{}',
  deadline         text,
  notes            text,
  artwork_filename text,
  artwork_url      text,
  mockup_url       text,
  placement        jsonb DEFAULT '{}',
  estimate         jsonb DEFAULT '{}',
  status           text NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','reviewed','quoted','archived')),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);

-- Storage bucket: create manually in Supabase Dashboard → Storage
-- Bucket name: proof-mockups
-- Set bucket to PUBLIC so images are accessible via URL
-- (Customer order artwork + mockups are stored under the orders/ prefix in this same bucket.)
