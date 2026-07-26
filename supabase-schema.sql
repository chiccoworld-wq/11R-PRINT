-- 11R Print — CRM System Schema Migration
-- Run this in Supabase SQL Editor (supabase.com → project → SQL Editor)
-- Safe to run multiple times (uses IF NOT EXISTS)

-- ── CUSTOMERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT NOT NULL,
  company           TEXT,
  email             TEXT,
  phone             TEXT,
  billing_address   TEXT,
  tax_exempt        BOOLEAN DEFAULT false,
  notes             TEXT,
  lead_source       TEXT,
  preferred_contact TEXT DEFAULT 'email',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- ── JOBS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  job_number      TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  status          TEXT DEFAULT 'new' CHECK (status IN ('new','quoted','approved','deposit_paid','in_production','qc','complete','cancelled')),
  due_date        DATE,
  garment_style   TEXT,
  garment_color   TEXT,
  quantity        INTEGER,
  sizes           JSONB DEFAULT '{}',
  print_locations JSONB DEFAULT '[]',
  ink_colors      TEXT,
  notes           TEXT,
  internal_notes  TEXT,
  artwork_url     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── INVOICES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number   TEXT UNIQUE NOT NULL,
  customer_id      UUID REFERENCES customers(id) ON DELETE SET NULL,
  job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
  status           TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','deposit_due','deposit_paid','partially_paid','paid','overdue','void')),
  subtotal         DECIMAL(10,2) DEFAULT 0,
  tax_rate         DECIMAL(6,5) DEFAULT 0,
  tax_amount       DECIMAL(10,2) DEFAULT 0,
  total            DECIMAL(10,2) DEFAULT 0,
  deposit_type     TEXT DEFAULT 'percent' CHECK (deposit_type IN ('percent','fixed')),
  deposit_value    DECIMAL(10,2) DEFAULT 50,
  deposit_required DECIMAL(10,2) DEFAULT 0,
  amount_paid      DECIMAL(10,2) DEFAULT 0,
  balance_due      DECIMAL(10,2) DEFAULT 0,
  due_date         DATE,
  terms            TEXT,
  notes            TEXT,
  internal_notes   TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ── INVOICE ITEMS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id  UUID REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity    DECIMAL(10,2) DEFAULT 1,
  unit_price  DECIMAL(10,2) DEFAULT 0,
  amount      DECIMAL(10,2) DEFAULT 0,
  sort_order  INTEGER DEFAULT 0
);

-- ── PAYMENTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number TEXT UNIQUE NOT NULL,
  invoice_id     UUID REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  receipt_id     UUID,  -- populated after receipt is created
  amount         DECIMAL(10,2) NOT NULL,
  method         TEXT DEFAULT 'cash' CHECK (method IN ('cash','card','check','zelle','venmo','stripe','ach','other')),
  reference      TEXT,
  paid_at        TIMESTAMPTZ DEFAULT now(),
  payment_type   TEXT DEFAULT 'deposit' CHECK (payment_type IN ('deposit','partial','final','refund')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── RECEIPTS (immutable snapshots) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  payment_id     UUID REFERENCES payments(id) ON DELETE SET NULL,
  invoice_id     UUID REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  snapshot       JSONB NOT NULL,  -- complete immutable record at time of payment
  emailed_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── ENABLE ROW LEVEL SECURITY ─────────────────────────────────────────────────
-- These tables are accessed only via the service key from Netlify functions.
-- RLS policies restrict public access.

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically — no policies needed.
-- If you ever add anon access, add explicit policies here.

-- ── INDEXES ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON receipts(payment_id);
