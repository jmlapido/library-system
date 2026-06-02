DO $$ BEGIN
  CREATE TYPE webhook_event AS ENUM (
    'checkout.created',
    'checkout.returned',
    'hold.placed',
    'hold.ready',
    'overdue.alert'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  url VARCHAR(2048) NOT NULL,
  secret VARCHAR(255) NOT NULL,
  events webhook_event[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
