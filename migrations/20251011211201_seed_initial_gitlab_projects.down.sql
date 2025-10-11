-- Rollback: seed_initial_gitlab_projects
-- Created: 2025-10-11 21:12:01

-- Remove seeded GitLab projects
DELETE FROM projects WHERE type = 'gitlab' AND name IN ('nakit-yok/backend', 'nakit-yok/frontend');
