CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  status_token_hash TEXT NOT NULL UNIQUE,
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  account_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('initiating', 'pending', 'succeeded', 'failed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS donations_checkout_request_id_idx
  ON donations (checkout_request_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  counter_key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (counter_key, bucket)
);

CREATE INDEX IF NOT EXISTS rate_limits_bucket_idx ON rate_limits (bucket);
