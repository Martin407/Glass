ALTER TABLE schedule_configs ADD COLUMN trigger_type TEXT DEFAULT 'schedule';
ALTER TABLE schedule_configs ADD COLUMN api_token TEXT;
ALTER TABLE schedule_configs ADD COLUMN github_repo TEXT;
ALTER TABLE schedule_configs ADD COLUMN github_events TEXT;
ALTER TABLE schedule_configs ADD COLUMN github_filters TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS schedule_configs_api_token_idx ON schedule_configs (api_token);
CREATE INDEX IF NOT EXISTS schedule_configs_github_lookup_idx ON schedule_configs (trigger_type, github_repo, is_active);
