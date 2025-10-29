-- Add implementation quota columns to user_quotas table
ALTER TABLE user_quotas
ADD COLUMN implementations_used INTEGER NOT NULL DEFAULT 0,
ADD COLUMN implementations_soft_limit INTEGER NOT NULL DEFAULT 2,
ADD COLUMN implementations_hard_limit INTEGER NOT NULL DEFAULT 3;

-- Add check constraint for implementation quotas
ALTER TABLE user_quotas
ADD CONSTRAINT check_implementation_quotas CHECK (
  implementations_used >= 0 AND
  implementations_soft_limit >= 0 AND
  implementations_hard_limit >= implementations_soft_limit
);

-- Add comment
COMMENT ON COLUMN user_quotas.implementations_used IS 'Number of task implementations used by the user';
COMMENT ON COLUMN user_quotas.implementations_soft_limit IS 'Soft limit for implementations (warning threshold)';
COMMENT ON COLUMN user_quotas.implementations_hard_limit IS 'Hard limit for implementations (enforcement threshold)';
