// ── Resource types ────────────────────────────────────────────────────────────

export interface FileResource {
  type: 'file';
  id: string;
  file_id: string;
  mount_path?: string;
  created_at?: string;
}

export interface GitHubResource {
  type: 'github_repository';
  id: string;
  url: string;
  checkout?: { type: 'branch' | 'commit'; value: string };
  created_at?: string;
}

export type SessionResource = FileResource | GitHubResource;

// ── Event types ──────────────────────────────────────────────────────────────

export type SessionEventType =
  | 'user.message'
  | 'user.interrupt'
  | 'user.tool_confirmation'
  | 'user.custom_tool_result'
  | 'agent.message'
  | 'agent.thinking'
  | 'agent.tool_use'
  | 'agent.tool_result'
  | 'agent.mcp_tool_use'
  | 'agent.mcp_tool_result'
  | 'agent.custom_tool_use'
  | 'agent.thread_context_compacted'
  | 'session.status_running'
  | 'session.status_idle'
  | 'session.status_rescheduled'
  | 'session.status_terminated'
  | 'session.deleted'
  | 'session.error'
  | 'span.model_request_start'
  | 'span.model_request_end';

export interface StopReasonEndTurn { type: 'end_turn' }
export interface StopReasonRequiresAction { type: 'requires_action'; event_ids: string[] }
export interface StopReasonRetriesExhausted { type: 'retries_exhausted' }
export type StopReason = StopReasonEndTurn | StopReasonRequiresAction | StopReasonRetriesExhausted;

export interface ErrorRetryStatus {
  type: 'retrying' | 'exhausted' | 'terminal';
}
export type ErrorType =
  | 'unknown_error'
  | 'model_overloaded_error'
  | 'model_rate_limited_error'
  | 'model_request_failed_error'
  | 'mcp_connection_failed_error'
  | 'mcp_authentication_failed_error'
  | 'billing_error';

export interface SessionErrorPayload {
  type: ErrorType;
  message: string;
  retry_status: ErrorRetryStatus;
  mcp_server_name?: string;
}

export interface ModelUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  speed?: 'standard' | 'fast' | null;
}

export interface RawEvent {
  id?: string;
  type: SessionEventType;
  content?: Array<{ type?: string; text?: string }>;
  name?: string;
  tool_name?: string;
  mcp_server_name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  mcp_tool_use_id?: string;
  custom_tool_use_id?: string;
  is_error?: boolean;
  evaluated_permission?: 'allow' | 'ask' | 'deny';
  stop_reason?: StopReason;
  error?: SessionErrorPayload;
  model_request_start_id?: string;
  model_usage?: ModelUsage;
  is_error_span?: boolean;
  processed_at?: string;
}

// ── UI message shapes ─────────────────────────────────────────────────────────

export type MessageKind =
  | 'user'
  | 'agent'
  | 'thinking'
  | 'tool_use'
  | 'tool_result'
  | 'mcp_tool_use'
  | 'mcp_tool_result'
  | 'custom_tool_use'
  | 'status'
  | 'error'
  | 'compacted'
  | 'token_usage'
  | 'requires_action';

export interface UiMessage {
  id: string;
  kind: MessageKind;
  content?: string;
  toolName?: string;
  mcpServer?: string;
  toolInput?: Record<string, unknown>;
  eventId?: string;
  toolUseId?: string;
  customToolUseId?: string;
  isError?: boolean;
  permission?: 'allow' | 'ask' | 'deny';
  pendingEventIds?: string[];
  usage?: ModelUsage;
  errorPayload?: SessionErrorPayload;
}
