CREATE TABLE IF NOT EXISTS worker_change_requests (
  id text PRIMARY KEY,
  worker_id text NOT NULL,
  worker_name text,
  field text NOT NULL,
  field_label text,
  before text,
  proposed text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text
);

ALTER TABLE worker_change_requests DISABLE ROW LEVEL SECURITY;
