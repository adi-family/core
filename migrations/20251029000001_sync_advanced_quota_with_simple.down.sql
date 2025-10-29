-- Revert advanced evaluation quota limits to original defaults
UPDATE user_quotas
SET
  advanced_evaluations_soft_limit = 0,
  advanced_evaluations_hard_limit = 1,
  updated_at = NOW();
