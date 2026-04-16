ALTER TABLE schedule_configs ADD COLUMN trigger_type TEXT DEFAULT 'schedule';
ALTER TABLE schedule_configs ADD COLUMN api_token TEXT;
ALTER TABLE schedule_configs ADD COLUMN github_repo TEXT;
ALTER TABLE schedule_configs ADD COLUMN github_events TEXT;
ALTER TABLE schedule_configs ADD COLUMN github_filters TEXT;
