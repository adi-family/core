-- Create user_quotas table for tracking free evaluation quotas
CREATE TABLE user_quotas (
  user_id TEXT PRIMARY KEY,

  -- Simple evaluation quota (soft limit: 2, hard limit: 3)
  simple_evaluations_used INTEGER NOT NULL DEFAULT 0,
  simple_evaluations_soft_limit INTEGER NOT NULL DEFAULT 2,
  simple_evaluations_hard_limit INTEGER NOT NULL DEFAULT 3,

  -- Advanced evaluation quota (soft limit: 0, hard limit: 1)
  advanced_evaluations_used INTEGER NOT NULL DEFAULT 0,
  advanced_evaluations_soft_limit INTEGER NOT NULL DEFAULT 0,
  advanced_evaluations_hard_limit INTEGER NOT NULL DEFAULT 1,

  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure usage cannot be negative
  CONSTRAINT check_usage_non_negative CHECK (
    simple_evaluations_used >= 0 AND
    advanced_evaluations_used >= 0
  ),

  -- Ensure limits are logical
  CONSTRAINT check_limits_logical CHECK (
    simple_evaluations_soft_limit <= simple_evaluations_hard_limit AND
    advanced_evaluations_soft_limit <= advanced_evaluations_hard_limit
  )
);

-- Index for efficient lookups
CREATE INDEX idx_user_quotas_user_id ON user_quotas(user_id);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_user_quotas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_quotas_updated_at
  BEFORE UPDATE ON user_quotas
  FOR EACH ROW
  EXECUTE FUNCTION update_user_quotas_updated_at();
