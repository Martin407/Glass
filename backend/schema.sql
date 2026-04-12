-- User Metadata Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scim_id TEXT,
  first_name TEXT,
  last_name TEXT
);

-- OAuth Tokens Table
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, provider)
);

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

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_users_scim_id ON users(scim_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_id ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_configs_user_id ON schedule_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_configs_active ON schedule_configs(is_active);

-- Global Tool Permissions Table
CREATE TABLE IF NOT EXISTS global_tool_permissions (
  provider TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'read_only' or 'write_delete'
  permission TEXT NOT NULL DEFAULT 'auto', -- 'allow', 'ask', 'deny', 'auto'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(provider, tool_name)
);

-- Seed Initial Tool Permissions (Slack)
INSERT OR IGNORE INTO global_tool_permissions (provider, tool_name, type, permission) VALUES
  ('Slack', 'Schedule message', 'read_only', 'allow'),
  ('Slack', 'Search publics', 'read_only', 'allow'),
  ('Slack', 'Search public and privates', 'read_only', 'allow'),
  ('Slack', 'Search channels', 'read_only', 'allow'),
  ('Slack', 'Search users', 'read_only', 'allow'),
  ('Slack', 'Read channels', 'read_only', 'allow'),
  ('Slack', 'Read threads', 'read_only', 'allow'),
  ('Slack', 'Read canvas', 'read_only', 'allow'),
  ('Slack', 'Read user profiles', 'read_only', 'allow'),
  ('Slack', 'Send message', 'write_delete', 'ask'),
  ('Slack', 'Create canvas', 'write_delete', 'allow'),
  ('Slack', 'Update canvas', 'write_delete', 'ask');
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
