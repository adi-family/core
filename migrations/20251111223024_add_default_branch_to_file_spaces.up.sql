-- Add default_branch column to file_spaces table
ALTER TABLE file_spaces
ADD COLUMN default_branch TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN file_spaces.default_branch IS 'Default branch for merge requests (optional). If not set, the repository default branch will be used.';
