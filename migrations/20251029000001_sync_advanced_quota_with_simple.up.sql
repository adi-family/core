-- Update advanced evaluation quota limits to match simple evaluation limits
UPDATE user_quotas
SET
  advanced_evaluations_soft_limit = simple_evaluations_soft_limit,
  advanced_evaluations_hard_limit = simple_evaluations_hard_limit,
  updated_at = NOW();

-- Add comment explaining the synchronization
COMMENT ON COLUMN user_quotas.advanced_evaluations_soft_limit IS 'Soft limit for advanced evaluations (synced with simple evaluation limits)';
COMMENT ON COLUMN user_quotas.advanced_evaluations_hard_limit IS 'Hard limit for advanced evaluations (synced with simple evaluation limits)';
