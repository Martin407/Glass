src/
  types.ts                          — shared domain types (Agent, Environment, etc.)
  components/
    PermissionToggle.tsx            — MCP tool permission toggle
    GetStartedSection.tsx           — onboarding banner
    dialogs/
      CreateAgentDialog.tsx
      EditAgentDialog.tsx
      CreateEnvironmentDialog.tsx
      CreateSessionDialog.tsx
      AddCredentialDialog.tsx
    sections/
      SessionsList.tsx              — messages tab
      IntegrationsGrid.tsx          — integrations tab
      ConnectionsDetail.tsx         — connections settings
      AgentsSettings.tsx            — agents settings
      EnvironmentsSettings.tsx      — environments settings
      VaultSettings.tsx             — credential vault settings
    chat/
      types.ts                      — event/message type definitions
      utils.ts                      — extractText, formatInput, formatErrorType
      ToolCards.tsx                 — ToolUseCard, CustomToolUseCard, ExpandableToolCard
