import type React from 'react';

export interface Agent {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface Environment {
  id: string;
  name?: string;
  status?: string;
  created_at?: string;
}

export interface McpTool {
  name: string;
  description: string;
  status: string;
}

export type RailId = 'integrations' | 'documents' | 'messages' | 'automations' | 'settings' | 'data';
export type SettingsSubSection = 'connections' | 'agents' | 'environments' | 'vault' | null;

export interface CredentialVault {
  id: string;
  created_at?: string;
  display_name?: string;
  description?: string;
}

export interface VaultCredential {
  id: string;
  display_name?: string;
  auth: {
    type: 'mcp_oauth' | 'static_bearer';
    mcp_server_url: string;
    access_token?: string;
    token?: string;
    expires_at?: string;
  };
  created_at?: string;
  archived_at?: string | null;
}

export interface SessionRow {
  id: string;
  created_at?: string;
  title?: string | null;
  status?: string;
}

export interface AppProvider {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  connected: boolean;
  color: string;
}

export interface ScheduleConfig {
  id: string;
  agent_id: string;
  cron_expression: string;
  is_active: number;
  payload?: string;

  trigger_type?: 'schedule' | 'api' | 'github';
  api_token?: string;
  github_repo?: string;
  github_events?: string[];
  github_filters?: Record<string, string>;

  created_at?: string;
}
