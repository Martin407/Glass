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

CREATE TABLE IF NOT EXISTS environments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_environments_user_id ON environments(user_id);

-- Temporary state for in-flight MCP OAuth flows (PKCE + dynamic client registration).
-- Used by all providers (Linear, Slack, Notion, Figma, etc.) that share this flow.
-- Rows are short-lived (10 min TTL enforced in queries) and cleaned up on successful callback.
CREATE TABLE IF NOT EXISTS oauth_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT,
  code_verifier TEXT NOT NULL,
  token_endpoint TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_oauth_state_user_id ON oauth_state(user_id);

-- Credential Vaults Table — tracks Anthropic-side credential vaults per user.
-- One vault per user (UNIQUE user_id). The `id` is the Anthropic vault ID returned
-- by POST /v1/credential_vaults.
CREATE TABLE IF NOT EXISTS credential_vaults (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_credential_vaults_user_id ON credential_vaults(user_id);

-- Local auth bypass uses `user-123` (see index.ts). Satisfy FKs on agents/sessions/environments.
INSERT OR IGNORE INTO users (id, email) VALUES ('user-123', 'glass-dev@localhost');
