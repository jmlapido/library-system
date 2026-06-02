-- Fine tracking columns on checkouts table.
-- School fine configuration lives in schools.settings JSONB (no schema change needed).
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS fine_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS fine_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS fine_waived BOOLEAN DEFAULT FALSE;
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS fine_waived_by UUID REFERENCES users(id);
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS fine_waived_at TIMESTAMPTZ;
