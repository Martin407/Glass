INSERT OR IGNORE INTO users (id, email) VALUES ('user-123', 'test@test.com');
INSERT OR IGNORE INTO oauth_tokens (id, user_id, provider, access_token) VALUES ('token_1', 'user-123', 'Slack', 'dummy_token');
