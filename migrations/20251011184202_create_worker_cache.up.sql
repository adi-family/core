CREATE TABLE worker_task_cache (
    id SERIAL PRIMARY KEY,
    issue_id VARCHAR(255) NOT NULL,
    repo VARCHAR(255) NOT NULL,
    last_processed_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(issue_id, repo)
);

CREATE INDEX idx_worker_task_cache_issue_repo ON worker_task_cache(issue_id, repo);
