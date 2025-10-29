-- Remove implementation quota columns from user_quotas table
ALTER TABLE user_quotas
DROP CONSTRAINT IF EXISTS check_implementation_quotas,
DROP COLUMN IF EXISTS implementations_used,
DROP COLUMN IF EXISTS implementations_soft_limit,
DROP COLUMN IF EXISTS implementations_hard_limit;
