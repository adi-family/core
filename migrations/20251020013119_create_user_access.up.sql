-- Migration: create_user_access
-- Created: 2025-10-20 01:31:19

CREATE TABLE user_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN (
        'project',
        'task_source',
        'file_space',
        'secret',
        'task'
    )),
    entity_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
        'owner',
        'admin',
        'developer',
        'viewer',
        'read',
        'write',
        'use'
    )),
    granted_by TEXT,
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, entity_type, entity_id, role)
);

CREATE INDEX idx_user_access_user_id ON user_access(user_id);
CREATE INDEX idx_user_access_entity ON user_access(entity_type, entity_id);
CREATE INDEX idx_user_access_lookup ON user_access(user_id, entity_type, entity_id);
CREATE INDEX idx_user_access_expires_at ON user_access(expires_at) WHERE expires_at IS NOT NULL;

