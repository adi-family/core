-- Drop user_quotas table and related objects
DROP TRIGGER IF EXISTS trigger_user_quotas_updated_at ON user_quotas;
DROP FUNCTION IF EXISTS update_user_quotas_updated_at();
DROP TABLE IF EXISTS user_quotas;
