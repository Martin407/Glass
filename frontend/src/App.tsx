import { useState, useEffect, useCallback, useRef } from 'react';
import { agentsApi } from './lib/agentsApi';
import { ChatWindow } from './components/ChatWindow';
import {
  Grid,
  MessageSquare,
  Zap,
  Settings,
  Plus,
  MonitorPlay,
  FileText,
  Database,
  PenTool,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Bot,
  Server,
} from 'lucide-react';
import type { Agent, AppProvider, CredentialVault, Environment, McpTool, RailId, SessionRow, SettingsSubSection, VaultCredential } from './types';
import { GetStartedSection } from './components/GetStartedSection';
import { CreateAgentDialog } from './components/dialogs/CreateAgentDialog';
import { EditAgentDialog } from './components/dialogs/EditAgentDialog';
import { CreateEnvironmentDialog } from './components/dialogs/CreateEnvironmentDialog';
import { CreateSessionDialog, type GithubRepo } from './components/dialogs/CreateSessionDialog';
import { AddCredentialDialog } from './components/dialogs/AddCredentialDialog';
import { AddConnectionDialog } from './components/dialogs/AddConnectionDialog';
import { SessionsList } from './components/sections/SessionsList';
import { AutomationsList } from './components/automations/AutomationsList';
import { IntegrationsGrid } from './components/sections/IntegrationsGrid';
import { ConnectionsDetail } from './components/sections/ConnectionsDetail';
import { AgentsSettings } from './components/sections/AgentsSettings';
import { EnvironmentsSettings } from './components/sections/EnvironmentsSettings';
import { VaultSettings } from './components/sections/VaultSettings';

// Providers that support the MCP OAuth flow (PKCE + dynamic client registration).
const OAUTH_PROVIDERS = new Set(['Linear', 'Slack', 'Notion', 'Figma']);

const INITIAL_APPS: AppProvider[] = [
  { name: 'Slack', icon: MessageSquare, connected: false, color: 'text-blue-500' },
  { name: 'Notion', icon: FileText, connected: false, color: 'text-gray-900' },
  { name: 'Figma', icon: PenTool, connected: false, color: 'text-pink-500' },
  { name: 'Linear', icon: Zap, connected: false, color: 'text-indigo-500' },
];

const logApiError = (context: string) => (err: unknown) => {
  const error = err instanceof Error ? err : new Error(context, { cause: err });
  console.error(context, error);
};

const railItems: { id: RailId; Icon: typeof Grid; label: string }[] = [
  { id: 'integrations', Icon: Grid, label: 'Integrations' },
  { id: 'documents', Icon: FileText, label: 'Documents' },
  { id: 'data', Icon: Database, label: 'Data Sources' },
  { id: 'messages', Icon: MessageSquare, label: 'Messages' },
  { id: 'automations', Icon: Zap, label: 'Automations' },
  { id: 'settings', Icon: Settings, label: 'Setup and API' },
];

function App() {
  const [appState, setAppState] = useState(INITIAL_APPS);
  const [selectedProvider, setSelectedProvider] = useState('Slack');
  const [readOnlyTools, setReadOnlyTools] = useState<McpTool[]>([]);
  const [writeDeleteTools, setWriteDeleteTools] = useState<McpTool[]>([]);
  const [activeSessions, setActiveSessions] = useState<{ id: string, x: number, y: number }[]>([]);
  const [savedSessions, setSavedSessions] = useState<SessionRow[]>([]);
  const [sessionsMenuOpen, setSessionsMenuOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [environmentsError, setEnvironmentsError] = useState<string | null>(null);
  const [activeRail, setActiveRail] = useState<RailId>('messages');
  const [settingsSubSection, setSettingsSubSection] = useState<SettingsSubSection>(null);
  const [bootstrapBusy, setBootstrapBusy] = useState<'agent' | 'environment' | null>(null);

  // Create agent dialog
  const [createAgentDialogOpen, setCreateAgentDialogOpen] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentModel, setNewAgentModel] = useState('claude-sonnet-4-6');
  const [newAgentSystemPrompt, setNewAgentSystemPrompt] = useState('');
  const [newAgentSpeed, setNewAgentSpeed] = useState<'standard' | 'fast'>('standard');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [createAgentBusy, setCreateAgentBusy] = useState(false);
  const [createAgentError, setCreateAgentError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Edit agent dialog
  const [editAgentDialogOpen, setEditAgentDialogOpen] = useState(false);
  const [editAgentId, setEditAgentId] = useState<string | null>(null);
  const [editAgentName, setEditAgentName] = useState('');
  const [editAgentModel, setEditAgentModel] = useState('claude-sonnet-4-6');
  const [editAgentSpeed, setEditAgentSpeed] = useState<'standard' | 'fast'>('standard');
  const [editAgentDescription, setEditAgentDescription] = useState('');
  const [editAgentSystemPrompt, setEditAgentSystemPrompt] = useState('');
  const [editAgentBusy, setEditAgentBusy] = useState(false);
  const [editAgentError, setEditAgentError] = useState<string | null>(null);

  // Agent action and versions
  const [agentActionBusy, setAgentActionBusy] = useState<string | null>(null);
  const [agentVersionsAgentId, setAgentVersionsAgentId] = useState<string | null>(null);
  const [agentVersions, setAgentVersions] = useState<unknown[]>([]);
  const [agentVersionsBusy, setAgentVersionsBusy] = useState(false);

  // Create environment dialog
  const [createEnvironmentDialogOpen, setCreateEnvironmentDialogOpen] = useState(false);
  const [newEnvironmentName, setNewEnvironmentName] = useState('');
  const [newEnvironmentDescription, setNewEnvironmentDescription] = useState('');
  const [newEnvironmentNetworking, setNewEnvironmentNetworking] = useState<'unrestricted' | 'limited'>('unrestricted');
  const [newEnvironmentAllowedHosts, setNewEnvironmentAllowedHosts] = useState('');
  const [newEnvironmentAllowMcpServers, setNewEnvironmentAllowMcpServers] = useState(false);
  const [newEnvironmentPackages, setNewEnvironmentPackages] = useState({
    npm: false, pip: false, apt: false, cargo: false, gem: false, go: false,
  });
  const [createEnvironmentBusy, setCreateEnvironmentBusy] = useState(false);
  const [createEnvironmentError, setCreateEnvironmentError] = useState<string | null>(null);
  const [environmentActionBusy, setEnvironmentActionBusy] = useState<string | null>(null);

  // Create session dialog
  const [createSessionDialogOpen, setCreateSessionDialogOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionVaultId, setNewSessionVaultId] = useState('');
  const [newSessionAgentId, setNewSessionAgentId] = useState('');
  const [newSessionEnvironmentId, setNewSessionEnvironmentId] = useState('');
  const [newSessionGithubRepos, setNewSessionGithubRepos] = useState<GithubRepo[]>([]);
  const [createSessionBusy, setCreateSessionBusy] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);
  const [sessionActionBusy, setSessionActionBusy] = useState<string | null>(null);

  // MCP connections
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);
  const [refreshToolsBusy, setRefreshToolsBusy] = useState(false);
  const [toolsVersion, setToolsVersion] = useState(0);
  const autoRefreshedProviders = useRef<Set<string>>(new Set());
  const [addConnectionDialogOpen, setAddConnectionDialogOpen] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState('');

  // Credential vault
  const [credentialVaults, setCredentialVaults] = useState<CredentialVault[]>([]);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [newVaultDisplayName, setNewVaultDisplayName] = useState('');
  const [newVaultDescription, setNewVaultDescription] = useState('');
  const [vaultCredentials, setVaultCredentials] = useState<VaultCredential[]>([]);
  const [vaultCredentialsBusy, setVaultCredentialsBusy] = useState(false);
  const [addCredentialDialogOpen, setAddCredentialDialogOpen] = useState(false);
  const [newCredentialType, setNewCredentialType] = useState<'mcp_oauth' | 'static_bearer'>('mcp_oauth');
  const [newCredentialDisplayName, setNewCredentialDisplayName] = useState('');
  const [newCredentialMcpServerUrl, setNewCredentialMcpServerUrl] = useState('');
  const [newCredentialAccessToken, setNewCredentialAccessToken] = useState('');
  const [newCredentialToken, setNewCredentialToken] = useState('');
  const [newCredentialBusy, setNewCredentialBusy] = useState(false);
  const [newCredentialError, setNewCredentialError] = useState<string | null>(null);
  const [credentialActionBusy, setCredentialActionBusy] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────────

  const refreshSessions = useCallback(async () => {
    try {
      const res = await agentsApi.listSessions();
      setSavedSessions(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      logApiError('Failed to list sessions')(err);
      setSavedSessions([]);
    }
  }, []);

  const refreshAgentsAndEnvironments = useCallback(async () => {
    setAgentsError(null);
    setEnvironmentsError(null);
    try {
      const res = await agentsApi.listAgents();
      setAgents(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      logApiError('Failed to list agents')(err);
      setAgents([]);
      setAgentsError(err instanceof Error ? err.message : String(err));
    }
    try {
      const res = await agentsApi.listEnvironments();
      setEnvironments(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      logApiError('Failed to list environments')(err);
      setEnvironments([]);
      setEnvironmentsError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshCredentialVaults = useCallback(async () => {
    try {
      const res = await agentsApi.listCredentialVaults() as { data?: CredentialVault[] };
      setCredentialVaults(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      logApiError('Failed to list credential vaults')(err);
      setCredentialVaults([]);
    }
  }, []);

  const refreshVaultCredentials = useCallback(async (vaultId: string) => {
    setVaultCredentialsBusy(true);
    try {
      const res = await agentsApi.listVaultCredentials(vaultId) as { data?: VaultCredential[] };
      setVaultCredentials(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      logApiError('Failed to list vault credentials')(err);
      setVaultCredentials([]);
    } finally {
      setVaultCredentialsBusy(false);
    }
  }, []);

  const refreshConnections = useCallback(() => {
    agentsApi.getMcpConnections().then((res: { connections?: string[] }) => {
      if (res.connections) {
        const connectionsSet = new Set(res.connections);
        setAppState(prev => prev.map(app => ({ ...app, connected: connectionsSet.has(app.name) })));
      }
    }).catch(logApiError('Failed to get MCP connections'));
  }, []);

  useEffect(() => { void refreshAgentsAndEnvironments(); }, [refreshAgentsAndEnvironments]);
  useEffect(() => { void refreshSessions(); }, [refreshSessions]);
  useEffect(() => { refreshConnections(); }, [refreshConnections]);

  useEffect(() => {
    const isConnectionsVisible =
      activeRail === 'integrations' ||
      (activeRail === 'settings' && settingsSubSection === 'connections');
    if (!isConnectionsVisible) return;
    const id = setInterval(refreshConnections, 3000);
    return () => clearInterval(id);
  }, [activeRail, settingsSubSection, refreshConnections]);

  useEffect(() => {
    if (activeRail === 'settings' && settingsSubSection === 'vault') {
      void refreshCredentialVaults().then(() => {
        if (credentialVaults.length > 0) {
          void refreshVaultCredentials(credentialVaults[0].id);
        }
      });
    }
  }, [activeRail, settingsSubSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeRail === 'settings' && settingsSubSection === 'vault' && credentialVaults.length > 0) {
      void refreshVaultCredentials(credentialVaults[0].id);
    }
  }, [credentialVaults, activeRail, settingsSubSection, refreshVaultCredentials]);

  // Handle OAuth callback redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const oauthError = params.get('oauth_error');
    if (connected) {
      window.history.replaceState({}, '', window.location.pathname);
      refreshConnections();
      setSelectedProvider(connected);
      setActiveRail('settings');
      setSettingsSubSection('connections');
      agentsApi.refreshMcpTools(connected)
        .then(() => setToolsVersion(v => v + 1))
        .catch(logApiError(`Failed to refresh tools for ${connected}`));
    } else if (oauthError) {
      const provider = params.get('provider') ?? 'unknown';
      window.history.replaceState({}, '', window.location.pathname);
      console.error(`OAuth error for ${provider}:`, oauthError);
    }
  }, [refreshConnections]);

  useEffect(() => {
    agentsApi.getMcpTools(selectedProvider).then((res: { read_only?: McpTool[], write_delete?: McpTool[] }) => {
      const readOnly = res.read_only || [];
      const writeDelete = res.write_delete || [];
      setReadOnlyTools(readOnly);
      setWriteDeleteTools(writeDelete);
      if (
        readOnly.length === 0 &&
        writeDelete.length === 0 &&
        OAUTH_PROVIDERS.has(selectedProvider) &&
        !autoRefreshedProviders.current.has(selectedProvider)
      ) {
        autoRefreshedProviders.current.add(selectedProvider);
        agentsApi.refreshMcpTools(selectedProvider)
          .then(() => setToolsVersion(v => v + 1))
          .catch(logApiError(`Failed to auto-refresh tools for ${selectedProvider}`));
      }
    }).catch((err: unknown) => {
      setReadOnlyTools([]);
      setWriteDeleteTools([]);
      logApiError('Failed to get MCP tools')(err);
    });
  }, [selectedProvider, toolsVersion]);

  // ── Session handlers ─────────────────────────────────────────────────────────

  const handleOpenExistingSession = (sessionId: string) => {
    setActiveSessions(prev =>
      prev.some(s => s.id === sessionId)
        ? prev
        : [...prev, { id: sessionId, x: 100 + prev.length * 30, y: 100 + prev.length * 30 }],
    );
    setSessionsMenuOpen(false);
  };

  const handleOpenCreateSessionDialog = () => {
    setNewSessionAgentId(selectedAgentId ?? (agents[0]?.id ?? ''));
    setNewSessionEnvironmentId(environments[0]?.id ?? '');
    setNewSessionTitle('');
    setNewSessionVaultId('');
    setNewSessionGithubRepos([]);
    setCreateSessionError(null);
    setCreateSessionDialogOpen(true);
  };

  const handleCreateSession = async () => {
    if (!newSessionAgentId || !newSessionEnvironmentId) return;
    setCreateSessionBusy(true);
    setCreateSessionError(null);
    try {
      const payload: Record<string, unknown> = {
        agent: newSessionAgentId,
        environment_id: newSessionEnvironmentId,
      };
      if (newSessionTitle.trim()) payload.title = newSessionTitle.trim();
      if (newSessionVaultId) payload.vault_id = newSessionVaultId;

      const validRepos = newSessionGithubRepos.filter(r => r.url.trim());
      if (validRepos.length > 0) {
        payload.resources = validRepos.map(repo => {
          const resPayload: Record<string, unknown> = {
            type: 'github_repository',
            url: repo.url.trim()
          };
          if (repo.token.trim()) {
            resPayload.authorization_token = repo.token.trim();
          }
          return resPayload;
        });
      }

      const res = await agentsApi.createSession(payload);
      if (res.id) {
        setActiveSessions(prev => [...prev, { id: res.id, x: 100 + prev.length * 30, y: 100 + prev.length * 30 }]);
        void refreshSessions();
      }
      setCreateSessionDialogOpen(false);
      setNewSessionTitle('');
      setNewSessionVaultId('');
      setNewSessionGithubRepos([]);
    } catch (err) {
      setCreateSessionError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreateSessionBusy(false);
    }
  };

  const handleArchiveSession = async (id: string) => {
    setSessionActionBusy(id);
    try {
      await agentsApi.archiveSession(id);
      await refreshSessions();
    } catch (err) {
      logApiError('Failed to archive session')(err);
    } finally {
      setSessionActionBusy(null);
    }
  };

  const handleDeleteSession = async (id: string) => {
    setSessionActionBusy(id);
    try {
      await agentsApi.deleteSession(id);
      await refreshSessions();
    } catch (err) {
      logApiError('Failed to delete session')(err);
    } finally {
      setSessionActionBusy(null);
    }
  };

  // ── Bootstrap handlers ────────────────────────────────────────────────────────

  const handleCreateStarterAgent = async () => {
    setBootstrapBusy('agent');
    try {
      await agentsApi.createAgent({ model: 'claude-sonnet-4-6', name: 'Glass starter agent' });
      await refreshAgentsAndEnvironments();
    } catch (err) {
      logApiError('Failed to create starter agent')(err);
    } finally {
      setBootstrapBusy(null);
    }
  };

  const handleCreateStarterEnvironment = async () => {
    setBootstrapBusy('environment');
    try {
      await agentsApi.createEnvironment({
        name: 'Glass local environment',
        config: { type: 'cloud', networking: { type: 'unrestricted' } },
      });
      await refreshAgentsAndEnvironments();
    } catch (err) {
      logApiError('Failed to create starter environment')(err);
    } finally {
      setBootstrapBusy(null);
    }
  };

  // ── Agent handlers ────────────────────────────────────────────────────────────

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    setCreateAgentBusy(true);
    setCreateAgentError(null);
    try {
      const payload: Record<string, unknown> = {
        model: newAgentModel,
        name: newAgentName.trim(),
        model_config: { speed: newAgentSpeed },
      };
      if (newAgentSystemPrompt.trim()) payload.system_prompt = newAgentSystemPrompt.trim();
      if (newAgentDescription.trim()) payload.description = newAgentDescription.trim();
      const created = await agentsApi.createAgent(payload);
      await refreshAgentsAndEnvironments();
      if (created?.id) setSelectedAgentId(created.id);
      setCreateAgentDialogOpen(false);
      setNewAgentName('');
      setNewAgentSystemPrompt('');
      setNewAgentModel('claude-sonnet-4-6');
      setNewAgentSpeed('standard');
      setNewAgentDescription('');
    } catch (err) {
      setCreateAgentError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreateAgentBusy(false);
    }
  };

  const handleOpenEditAgent = (agent: Agent) => {
    setEditAgentId(agent.id);
    setEditAgentName(agent.name || '');
    setEditAgentModel('claude-sonnet-4-6');
    setEditAgentSpeed('standard');
    setEditAgentDescription(agent.description || '');
    setEditAgentSystemPrompt('');
    setEditAgentError(null);
    setEditAgentDialogOpen(true);
  };

  const handleUpdateAgent = async () => {
    if (!editAgentId || !editAgentName.trim()) return;
    setEditAgentBusy(true);
    setEditAgentError(null);
    try {
      const payload: Record<string, unknown> = {
        name: editAgentName.trim(),
        model: editAgentModel,
        model_config: { speed: editAgentSpeed },
      };
      if (editAgentDescription.trim()) payload.description = editAgentDescription.trim();
      if (editAgentSystemPrompt.trim()) payload.system_prompt = editAgentSystemPrompt.trim();
      await agentsApi.updateAgent(editAgentId, payload);
      await refreshAgentsAndEnvironments();
      setEditAgentDialogOpen(false);
    } catch (err) {
      setEditAgentError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditAgentBusy(false);
    }
  };

  const handleArchiveAgent = async (id: string) => {
    setAgentActionBusy(id);
    try {
      await agentsApi.archiveAgent(id);
      await refreshAgentsAndEnvironments();
    } catch (err) {
      logApiError('Failed to archive agent')(err);
    } finally {
      setAgentActionBusy(null);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    setAgentActionBusy(id);
    try {
      await agentsApi.deleteAgent(id);
      await refreshAgentsAndEnvironments();
    } catch (err) {
      logApiError('Failed to delete agent')(err);
    } finally {
      setAgentActionBusy(null);
    }
  };

  const handleViewAgentVersions = async (id: string) => {
    if (agentVersionsAgentId === id) {
      setAgentVersionsAgentId(null);
      setAgentVersions([]);
      return;
    }
    setAgentVersionsAgentId(id);
    setAgentVersionsBusy(true);
    try {
      const res = await agentsApi.getAgentVersions(id);
      setAgentVersions(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      logApiError('Failed to get agent versions')(err);
      setAgentVersions([]);
    } finally {
      setAgentVersionsBusy(false);
    }
  };

  // ── Environment handlers ──────────────────────────────────────────────────────

  const handleCreateEnvironment = async () => {
    if (!newEnvironmentName.trim()) return;
    setCreateEnvironmentBusy(true);
    setCreateEnvironmentError(null);
    try {
      const networking: Record<string, unknown> = { type: newEnvironmentNetworking };
      if (newEnvironmentNetworking === 'limited') {
        const hosts = newEnvironmentAllowedHosts.split(',').map(h => h.trim()).filter(Boolean);
        if (hosts.length > 0) networking.allowed_hosts = hosts;
        networking.allow_mcp_servers = newEnvironmentAllowMcpServers;
        const enabledPackages = Object.entries(newEnvironmentPackages).filter(([, v]) => v).map(([k]) => k);
        if (enabledPackages.length > 0) networking.packages = enabledPackages;
      }
      const envPayload: Record<string, unknown> = {
        name: newEnvironmentName.trim(),
        config: { type: 'cloud', networking },
      };
      if (newEnvironmentDescription.trim()) envPayload.description = newEnvironmentDescription.trim();
      await agentsApi.createEnvironment(envPayload);
      await refreshAgentsAndEnvironments();
      setCreateEnvironmentDialogOpen(false);
      setNewEnvironmentName('');
      setNewEnvironmentDescription('');
      setNewEnvironmentNetworking('unrestricted');
      setNewEnvironmentAllowedHosts('');
      setNewEnvironmentAllowMcpServers(false);
      setNewEnvironmentPackages({ npm: false, pip: false, apt: false, cargo: false, gem: false, go: false });
    } catch (err) {
      setCreateEnvironmentError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreateEnvironmentBusy(false);
    }
  };

  const handleArchiveEnvironment = async (envId: string) => {
    setEnvironmentActionBusy(envId);
    try {
      await agentsApi.archiveEnvironment(envId);
      await refreshAgentsAndEnvironments();
    } catch (err) {
      logApiError('Failed to archive environment')(err);
    } finally {
      setEnvironmentActionBusy(null);
    }
  };

  const handleDeleteEnvironment = async (envId: string) => {
    setEnvironmentActionBusy(envId);
    try {
      await agentsApi.deleteEnvironment(envId);
      await refreshAgentsAndEnvironments();
    } catch (err) {
      logApiError('Failed to delete environment')(err);
    } finally {
      setEnvironmentActionBusy(null);
    }
  };

  // ── MCP / connections handlers ────────────────────────────────────────────────

  const handleToggle = (toolName: string, newStatus: string, type: 'read_only' | 'write_delete') => {
    agentsApi.updateMcpToolPermission(selectedProvider, toolName, newStatus).then(() => {
      if (type === 'read_only') {
        setReadOnlyTools(prev => prev.map(t => t.name === toolName ? { ...t, status: newStatus } : t));
      } else {
        setWriteDeleteTools(prev => prev.map(t => t.name === toolName ? { ...t, status: newStatus } : t));
      }
    }).catch(logApiError('Failed to update MCP tool permission'));
  };

  const handleRefreshTools = async () => {
    setRefreshToolsBusy(true);
    try {
      await agentsApi.refreshMcpTools(selectedProvider);
      setToolsVersion(v => v + 1);
    } catch (err) {
      logApiError(`Failed to refresh tools for ${selectedProvider}`)(err);
    } finally {
      setRefreshToolsBusy(false);
    }
  };

  const handleConnect = async (provider: string) => {
    setConnectingProvider(provider);
    try {
      const returnTo = window.location.origin + window.location.pathname;
      const res = await agentsApi.getProviderAuthUrl(provider, returnTo) as { url?: string };
      if (res.url) window.location.href = res.url;
    } catch (err) {
      logApiError(`Failed to get ${provider} auth URL`)(err);
      setConnectingProvider(null);
    }
  };

  const handleAddConnection = () => {
    const name = newConnectionName.trim();
    if (!name) return;
    const hasDuplicate = appState.some(app => app.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (hasDuplicate) return;
    setAppState(prev => [...prev, { name, icon: Zap, connected: false, color: 'text-gray-900' }]);
    setNewConnectionName('');
    setAddConnectionDialogOpen(false);
    setSelectedProvider(name);
  };

  // ── Vault handlers ────────────────────────────────────────────────────────────

  const handleCreateVault = async () => {
    setVaultBusy(true);
    setVaultError(null);
    try {
      const payload: Record<string, unknown> = { name: 'Glass MCP Credentials' };
      if (newVaultDisplayName.trim()) payload.display_name = newVaultDisplayName.trim();
      if (newVaultDescription.trim()) payload.description = newVaultDescription.trim();
      await agentsApi.createCredentialVault(payload);
      await refreshCredentialVaults();
      setNewVaultDisplayName('');
      setNewVaultDescription('');
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    } finally {
      setVaultBusy(false);
    }
  };

  const handleDeleteVault = async (vaultId: string) => {
    setVaultBusy(true);
    setVaultError(null);
    try {
      await agentsApi.deleteCredentialVault(vaultId);
      await refreshCredentialVaults();
      setVaultCredentials([]);
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : String(err));
    } finally {
      setVaultBusy(false);
    }
  };

  const handleAddCredential = async (vaultId: string) => {
    if (!newCredentialMcpServerUrl.trim()) return;
    setNewCredentialBusy(true);
    setNewCredentialError(null);
    try {
      const auth: Record<string, unknown> = {
        type: newCredentialType,
        mcp_server_url: newCredentialMcpServerUrl.trim(),
      };
      if (newCredentialType === 'mcp_oauth') {
        auth.access_token = newCredentialAccessToken;
      } else {
        auth.token = newCredentialToken;
      }
      const payload: Record<string, unknown> = { auth };
      if (newCredentialDisplayName.trim()) payload.display_name = newCredentialDisplayName.trim();
      await agentsApi.addVaultCredential(vaultId, payload);
      await refreshVaultCredentials(vaultId);
      setAddCredentialDialogOpen(false);
      setNewCredentialDisplayName('');
      setNewCredentialMcpServerUrl('');
      setNewCredentialAccessToken('');
      setNewCredentialToken('');
      setNewCredentialType('mcp_oauth');
    } catch (err) {
      setNewCredentialError(err instanceof Error ? err.message : String(err));
    } finally {
      setNewCredentialBusy(false);
    }
  };

  const handleDeleteCredential = async (vaultId: string, credId: string) => {
    setCredentialActionBusy(credId);
    try {
      await agentsApi.deleteVaultCredential(vaultId, credId);
      await refreshVaultCredentials(vaultId);
    } catch (err) {
      logApiError('Failed to delete credential')(err);
    } finally {
      setCredentialActionBusy(null);
    }
  };

  const handleArchiveCredential = async (vaultId: string, credId: string) => {
    setCredentialActionBusy(credId);
    try {
      await agentsApi.archiveVaultCredential(vaultId, credId);
      await refreshVaultCredentials(vaultId);
    } catch (err) {
      logApiError('Failed to archive credential')(err);
    } finally {
      setCredentialActionBusy(null);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────────

  const canCreateSession = agents.length > 0 && environments.length > 0;
  const apiKeyMissing =
    (agentsError?.includes('ANTHROPIC_API_KEY') ?? false) ||
    (environmentsError?.includes('ANTHROPIC_API_KEY') ?? false);
  const showGetStarted = !canCreateSession || !!agentsError || !!environmentsError;
  const selectedApp = appState.find(a => a.name === selectedProvider) || appState[0];
  const connectedProviders = appState.filter(a => a.connected);

  const handleSetRail = (id: RailId) => {
    setActiveRail(id);
    if (id !== 'settings') setSettingsSubSection(null);
  };

  const handleMonitorPlay = () => {
    if (canCreateSession) {
      void handleOpenCreateSessionDialog();
    } else {
      handleSetRail('messages');
    }
  };

  const headerLabel = (() => {
    if (activeRail === 'settings') {
      if (settingsSubSection === 'connections') return `Connections › ${selectedProvider}`;
      if (settingsSubSection === 'agents') return 'Settings › Agents';
      if (settingsSubSection === 'environments') return 'Settings › Environments';
      if (settingsSubSection === 'vault') return 'Settings › Credential Vault';
      return 'Settings';
    }
    if (activeRail === 'integrations') return 'Integrations';
    if (activeRail === 'documents') return 'Documents';
    if (activeRail === 'automations') return 'Automations';
    if (activeRail === 'data') return 'Data Sources';
    return 'Glass';
  })();

  const getStartedSection = (
    <GetStartedSection
      agentsError={agentsError}
      environmentsError={environmentsError}
      apiKeyMissing={apiKeyMissing}
      canCreateSession={canCreateSession}
      bootstrapBusy={bootstrapBusy}
      onCreateStarterAgent={() => void handleCreateStarterAgent()}
      onCreateStarterEnvironment={() => void handleCreateStarterEnvironment()}
    />
  );

  const comingSoonContent = (label: string) => (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="rounded-full bg-gray-100 p-4 mb-4">
        {label === 'Documents' ? <FileText size={32} className="text-gray-400" /> : <Zap size={32} className="text-gray-400" />}
      </div>
      <p className="text-gray-600 font-medium">{label}</p>
      <p className="text-sm text-gray-400 mt-1">Coming soon.</p>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans">
      {/* Dialogs */}
      <CreateAgentDialog
        open={createAgentDialogOpen}
        onClose={() => setCreateAgentDialogOpen(false)}
        name={newAgentName} setName={setNewAgentName}
        model={newAgentModel} setModel={setNewAgentModel}
        systemPrompt={newAgentSystemPrompt} setSystemPrompt={setNewAgentSystemPrompt}
        speed={newAgentSpeed} setSpeed={setNewAgentSpeed}
        description={newAgentDescription} setDescription={setNewAgentDescription}
        busy={createAgentBusy} error={createAgentError}
        onSubmit={() => void handleCreateAgent()}
      />
      <EditAgentDialog
        open={editAgentDialogOpen}
        onClose={() => setEditAgentDialogOpen(false)}
        name={editAgentName} setName={setEditAgentName}
        model={editAgentModel} setModel={setEditAgentModel}
        systemPrompt={editAgentSystemPrompt} setSystemPrompt={setEditAgentSystemPrompt}
        speed={editAgentSpeed} setSpeed={setEditAgentSpeed}
        description={editAgentDescription} setDescription={setEditAgentDescription}
        busy={editAgentBusy} error={editAgentError}
        onSubmit={() => void handleUpdateAgent()}
      />
      <CreateEnvironmentDialog
        open={createEnvironmentDialogOpen}
        onClose={() => setCreateEnvironmentDialogOpen(false)}
        name={newEnvironmentName} setName={setNewEnvironmentName}
        description={newEnvironmentDescription} setDescription={setNewEnvironmentDescription}
        networking={newEnvironmentNetworking} setNetworking={setNewEnvironmentNetworking}
        allowedHosts={newEnvironmentAllowedHosts} setAllowedHosts={setNewEnvironmentAllowedHosts}
        allowMcpServers={newEnvironmentAllowMcpServers} setAllowMcpServers={setNewEnvironmentAllowMcpServers}
        packages={newEnvironmentPackages} setPackages={setNewEnvironmentPackages}
        busy={createEnvironmentBusy} error={createEnvironmentError}
        onSubmit={() => void handleCreateEnvironment()}
      />
      <CreateSessionDialog
        open={createSessionDialogOpen}
        onClose={() => setCreateSessionDialogOpen(false)}
        agents={agents} environments={environments} credentialVaults={credentialVaults}
        agentId={newSessionAgentId} setAgentId={setNewSessionAgentId}
        environmentId={newSessionEnvironmentId} setEnvironmentId={setNewSessionEnvironmentId}
        title={newSessionTitle} setTitle={setNewSessionTitle}
        vaultId={newSessionVaultId} setVaultId={setNewSessionVaultId}
        githubRepos={newSessionGithubRepos} setGithubRepos={setNewSessionGithubRepos}
        busy={createSessionBusy} error={createSessionError}
        onSubmit={() => void handleCreateSession()}
      />
      <AddCredentialDialog
        open={addCredentialDialogOpen}
        vaultId={credentialVaults[0]?.id ?? ''}
        onClose={() => setAddCredentialDialogOpen(false)}
        displayName={newCredentialDisplayName} setDisplayName={setNewCredentialDisplayName}
        type={newCredentialType} setType={setNewCredentialType}
        mcpServerUrl={newCredentialMcpServerUrl} setMcpServerUrl={setNewCredentialMcpServerUrl}
        accessToken={newCredentialAccessToken} setAccessToken={setNewCredentialAccessToken}
        token={newCredentialToken} setToken={setNewCredentialToken}
        busy={newCredentialBusy} error={newCredentialError}
        onSubmit={(vaultId) => void handleAddCredential(vaultId)}
      />
      <AddConnectionDialog
        open={addConnectionDialogOpen}
        onClose={() => setAddConnectionDialogOpen(false)}
        name={newConnectionName}
        setName={setNewConnectionName}
        onSubmit={handleAddConnection}
      />

      {/* Primary rail navigation */}
      <div
        className="relative z-20 flex w-14 flex-shrink-0 flex-col items-center gap-6 border-r border-gray-200 bg-gray-50 py-4"
        role="navigation"
        aria-label="Main navigation"
      >
        {railItems.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={activeRail === id}
            onClick={() => handleSetRail(id)}
            className={`rounded-md p-2 [&_svg]:pointer-events-none ${
              activeRail === id
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            <Icon size={20} />
          </button>
        ))}
      </div>

      {/* Settings secondary sidebar */}
      {activeRail === 'settings' && (
        <div className="w-64 border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xs font-semibold text-gray-500 tracking-wider uppercase">Settings</h2>
          </div>
          {settingsSubSection === 'connections' ? (
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSettingsSubSection(null)}
                  className="flex items-center gap-1 text-xs text-gray-500 mb-3 hover:text-gray-700"
                >
                  <ChevronLeft size={12} /> Back
                </button>
                <div className="text-xs font-semibold text-gray-500 mb-2 tracking-wider">CONNECTIONS</div>
                <div className="space-y-1">
                  {appState.map((app, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedProvider(app.name)}
                      className={`w-full flex items-center justify-between px-2 py-2 rounded-md text-sm ${app.name === selectedProvider ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      <div className="flex items-center gap-3">
                        <app.icon size={16} className={`${app.name === selectedProvider ? '' : app.color}`} />
                        <span className={app.name === selectedProvider ? 'font-medium' : ''}>{app.name}</span>
                      </div>
                      {app.connected && <div className="w-2 h-2 rounded-full bg-green-500"></div>}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewConnectionName('');
                    setAddConnectionDialogOpen(true);
                  }}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <Plus size={16} /> Add connection
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-1">
                {[
                  { id: 'agents' as SettingsSubSection, icon: Bot, label: 'Agents' },
                  { id: 'environments' as SettingsSubSection, icon: Server, label: 'Environments' },
                  { id: 'connections' as SettingsSubSection, icon: Grid, label: 'Connections' },
                  { id: 'vault' as SettingsSubSection, icon: Database, label: 'Credential Vault' },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSettingsSubSection(id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${settingsSubSection === id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} />
                      <span>{label}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0">
          <div className="text-sm font-medium text-gray-700">{headerLabel}</div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => { void refreshSessions(); setSessionsMenuOpen(o => !o); }}
                className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
                aria-expanded={sessionsMenuOpen}
                aria-haspopup="menu"
              >
                Open session <ChevronDown size={14} className={sessionsMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
              </button>
              {sessionsMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default bg-transparent"
                    aria-label="Close session menu"
                    onClick={() => setSessionsMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-1 max-h-72 w-80 overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
                  >
                    {savedSessions.length === 0 ? (
                      <div className="px-3 py-2 text-gray-500">No sessions yet. Create one with New Session.</div>
                    ) : (
                      savedSessions.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          role="menuitem"
                          onClick={() => handleOpenExistingSession(s.id)}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-gray-50"
                        >
                          <span className="font-mono text-xs text-gray-900">{s.title || s.id}</span>
                          {s.created_at && <span className="text-xs text-gray-500">{s.created_at}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setCreateAgentDialogOpen(true); setCreateAgentError(null); }}
              className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
            >
              <Bot size={14} /> New Agent
            </button>
            {agents.length > 1 && (
              <select
                value={selectedAgentId ?? agents[0].id}
                onChange={e => setSelectedAgentId(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                title="Select agent for new session"
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name || a.id.substring(0, 12)}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={canCreateSession ? handleOpenCreateSessionDialog : undefined}
              disabled={!canCreateSession}
              title={!canCreateSession ? 'Create a managed agent and environment first (use Settings)' : 'Open a session with your first agent and environment'}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors ${!canCreateSession ? 'cursor-not-allowed bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              <Plus size={16} /> New Session
            </button>
            <span className="text-sm font-medium text-gray-500">Glass</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMonitorPlay}
                title={canCreateSession ? 'New Session' : 'View sessions'}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Monitor"
              >
                <MonitorPlay size={18} />
              </button>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                aria-label="Open setup"
                onClick={() => handleSetRail('settings')}
              >
                <Settings size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Content area */}
        {activeSessions.length > 0 ? (
          <div className="flex-1 flex flex-row h-full w-full overflow-x-auto">
            {activeSessions.map(session => (
              <ChatWindow
                key={session.id}
                sessionId={session.id}
                onClose={id => setActiveSessions(prev => prev.filter(s => s.id !== id))}
                defaultPosition={{ x: session.x, y: session.y }}
              />
            ))}
          </div>
        ) : activeRail === 'settings' ? (
          settingsSubSection === 'connections' ? (
            <ConnectionsDetail
              selectedProvider={selectedProvider}
              selectedApp={selectedApp}
              readOnlyTools={readOnlyTools}
              writeDeleteTools={writeDeleteTools}
              refreshToolsBusy={refreshToolsBusy}
              connectingProvider={connectingProvider}
              onRefreshTools={() => void handleRefreshTools()}
              onConnect={provider => void handleConnect(provider)}
              onToggle={handleToggle}
            />
          ) : settingsSubSection === 'agents' ? (
            <AgentsSettings
              agents={agents}
              agentActionBusy={agentActionBusy}
              agentVersionsAgentId={agentVersionsAgentId}
              agentVersions={agentVersions}
              agentVersionsBusy={agentVersionsBusy}
              selectedAgentId={selectedAgentId}
              showGetStarted={showGetStarted}
              getStartedSection={getStartedSection}
              onSelectAgent={setSelectedAgentId}
              onOpenCreate={() => { setCreateAgentDialogOpen(true); setCreateAgentError(null); }}
              onOpenEdit={handleOpenEditAgent}
              onArchive={id => void handleArchiveAgent(id)}
              onDelete={id => void handleDeleteAgent(id)}
              onViewVersions={id => void handleViewAgentVersions(id)}
            />
          ) : settingsSubSection === 'environments' ? (
            <EnvironmentsSettings
              environments={environments}
              environmentsError={environmentsError}
              environmentActionBusy={environmentActionBusy}
              onOpenCreate={() => { setCreateEnvironmentDialogOpen(true); setCreateEnvironmentError(null); }}
              onArchive={id => void handleArchiveEnvironment(id)}
              onDelete={id => void handleDeleteEnvironment(id)}
            />
          ) : settingsSubSection === 'vault' ? (
            <VaultSettings
              credentialVaults={credentialVaults}
              vaultCredentials={vaultCredentials}
              vaultCredentialsBusy={vaultCredentialsBusy}
              vaultBusy={vaultBusy}
              vaultError={vaultError}
              connectedProviders={connectedProviders}
              canCreateSession={canCreateSession}
              newVaultDisplayName={newVaultDisplayName}
              setNewVaultDisplayName={setNewVaultDisplayName}
              newVaultDescription={newVaultDescription}
              setNewVaultDescription={setNewVaultDescription}
              credentialActionBusy={credentialActionBusy}
              onCreateVault={() => void handleCreateVault()}
              onDeleteVault={id => void handleDeleteVault(id)}
              onOpenAddCredential={() => { setAddCredentialDialogOpen(true); setNewCredentialError(null); }}
              onArchiveCredential={(vaultId, credId) => void handleArchiveCredential(vaultId, credId)}
              onDeleteCredential={(vaultId, credId) => void handleDeleteCredential(vaultId, credId)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select a settings category from the sidebar.
            </div>
          )
        ) : activeRail === 'messages' ? (
          <SessionsList
            savedSessions={savedSessions}
            sessionActionBusy={sessionActionBusy}
            canCreateSession={canCreateSession}
            showGetStarted={showGetStarted}
            getStartedSection={getStartedSection}
            onOpenSession={handleOpenExistingSession}
            onNewSession={handleOpenCreateSessionDialog}
            onArchive={id => void handleArchiveSession(id)}
            onDelete={id => void handleDeleteSession(id)}
          />
        ) : activeRail === 'integrations' ? (
          <IntegrationsGrid
            appState={appState}
            connectingProvider={connectingProvider}
            onConnect={provider => void handleConnect(provider)}
            onNavigate={provider => { setSelectedProvider(provider); handleSetRail('settings'); setSettingsSubSection('connections'); }}
          />
        ) : activeRail === 'documents' ? (
          comingSoonContent('Documents')
        ) : activeRail === 'automations' ? (
          <AutomationsList agents={agents} />
        ) : activeRail === 'data' ? (
          comingSoonContent('Data Sources')
        ) : (
          <SessionsList
            savedSessions={savedSessions}
            sessionActionBusy={sessionActionBusy}
            canCreateSession={canCreateSession}
            showGetStarted={showGetStarted}
            getStartedSection={getStartedSection}
            onOpenSession={handleOpenExistingSession}
            onNewSession={handleOpenCreateSessionDialog}
            onArchive={id => void handleArchiveSession(id)}
            onDelete={id => void handleDeleteSession(id)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
