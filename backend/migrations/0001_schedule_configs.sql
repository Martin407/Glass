-- Schedule Configs Table
CREATE TABLE IF NOT EXISTS schedule_configs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  payload TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_schedule_configs_user_id ON schedule_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_configs_active ON schedule_configs(is_active);
