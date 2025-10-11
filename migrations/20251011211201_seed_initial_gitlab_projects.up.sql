-- Migration: seed_initial_gitlab_projects
-- Created: 2025-10-11 21:12:01

-- Seed GitLab projects from hardcoded REPOS array
INSERT INTO projects (name, type, config, enabled) VALUES
    ('nakit-yok/backend', 'gitlab', '{"repo": "nakit-yok/backend", "labels": ["DOIT"]}', true),
    ('nakit-yok/frontend', 'gitlab', '{"repo": "nakit-yok/frontend", "labels": ["DOIT"]}', true);
