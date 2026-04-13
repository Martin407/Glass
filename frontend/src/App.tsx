import { useState, useEffect } from 'react';
import { agentsApi } from './lib/agentsApi';
import { ChatWindow } from './components/ChatWindow';

interface Agent {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface McpTool {
  name: string;
  description: string;
  status: string;
}
import {
  Search,
  Grid,
  MessageSquare,
  Zap,
  Settings,
  MoreVertical,
  Plus,
  MonitorPlay,
  FileText,
  Database,
  BarChart,
  Target,
  Briefcase,
  Layers,
  Inbox,
  PenTool,
  ChevronDown
} from 'lucide-react';

const apps = [
  { name: 'Slack', icon: MessageSquare, connected: true, color: 'text-blue-500' },
  { name: 'Notion', icon: FileText, connected: true, color: 'text-gray-900' },
  { name: 'Figma', icon: PenTool, connected: true, color: 'text-pink-500' },
  { name: 'Linear', icon: Zap, connected: true, color: 'text-indigo-500' },
  { name: 'Datadog', icon: MonitorPlay, connected: true, color: 'text-purple-500' },
  { name: 'Ramplify', icon: Target, connected: true, color: 'text-gray-900' },
  { name: 'Snowflake', icon: Database, connected: true, color: 'text-blue-400' },
  { name: 'Postgres', icon: Database, connected: true, color: 'text-blue-600' },
  { name: 'Granola', icon: Layers, connected: true, color: 'text-green-500' },
  { name: 'Salesforce', icon: Briefcase, connected: true, color: 'text-blue-500' },
  { name: 'Gong', icon: BarChart, connected: true, color: 'text-purple-600' },
  { name: 'Growth', icon: Zap, connected: true, color: 'text-gray-900' },
  { name: 'Ramp Inspect', icon: Search, connected: true, color: 'text-green-600' },
  { name: 'Servo', icon: Settings, connected: true, color: 'text-gray-900' },
  { name: 'Hex', icon: Layers, connected: true, color: 'text-purple-600' },
  { name: 'Google Workspace', icon: Inbox, connected: false, color: 'text-blue-500' },
];





const PermissionToggle = ({ status, onToggle }: { status: string, onToggle: (newStatus: string) => void }) => {
  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs font-medium">
      <button
        onClick={() => onToggle('Auto')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Auto' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
        Auto
      </button>
      <button
        onClick={() => onToggle('Allow')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Allow' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Allow
      </button>
      <button
        onClick={() => onToggle('Ask')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Ask' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Ask
      </button>
      <button
        onClick={() => onToggle('Deny')}
        className={`px-3 py-1 rounded-md transition-colors ${status === 'Deny' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
        Deny
      </button>
    </div>
  );
};

const logApiError = (context: string) => (err: unknown) => {
  const error = err instanceof Error ? err : new Error(context, { cause: err });
  console.error(context, error);
};

function App() {
  const [appState, setAppState] = useState(apps);
  const [selectedProvider, setSelectedProvider] = useState('Slack');
  const [readOnlyTools, setReadOnlyTools] = useState<McpTool[]>([]);
  const [writeDeleteTools, setWriteDeleteTools] = useState<McpTool[]>([]);
  const [activeSessions, setActiveSessions] = useState<{ id: string, x: number, y: number }[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    agentsApi.listAgents().then((res: Agent[]) => {
      setAgents(res);
    }).catch(logApiError('Failed to list agents'));
  }, []);

  const handleCreateSession = async () => {
    if (agents.length === 0) return;
    try {
      const res = await agentsApi.createSession({ agent: agents[0].id });
      if (res.id) {
        setActiveSessions(prev => [
          ...prev,
          { id: res.id, x: 100 + (prev.length * 30), y: 100 + (prev.length * 30) }
        ]);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleCloseSession = (id: string) => {
    setActiveSessions(prev => prev.filter(s => s.id !== id));
  };

  useEffect(() => {
    agentsApi.getMcpConnections().then((res: { connections?: string[] }) => {
      if (res.connections) {
        const connectionsSet = new Set(res.connections);
        setAppState(prev => prev.map(app => ({
          ...app,
          connected: connectionsSet.has(app.name)
        })));
      }
    }).catch(logApiError('Failed to get MCP connections'));
  }, []);

  useEffect(() => {
    agentsApi.getMcpTools(selectedProvider).then((res: { read_only?: McpTool[], write_delete?: McpTool[] }) => {
      setReadOnlyTools(res.read_only || []);
      setWriteDeleteTools(res.write_delete || []);
    }).catch(logApiError('Failed to get MCP tools'));
  }, [selectedProvider]);

  const handleToggle = (toolName: string, newStatus: string, type: 'read_only' | 'write_delete') => {
    agentsApi.updateMcpToolPermission(selectedProvider, toolName, newStatus).then(() => {
      if (type === 'read_only') {
        setReadOnlyTools(prev => prev.map(t => t.name === toolName ? { ...t, status: newStatus } : t));
      } else {
        setWriteDeleteTools(prev => prev.map(t => t.name === toolName ? { ...t, status: newStatus } : t));
      }
    }).catch(logApiError('Failed to update MCP tool permission'));
  };

  const selectedApp = appState.find(a => a.name === selectedProvider) || appState[0];

  return (
    <div className="flex h-screen bg-white text-gray-900 font-sans">
      {/* Primary Sidebar */}
      <div className="w-14 border-r border-gray-200 flex flex-col items-center py-4 gap-6 bg-gray-50 flex-shrink-0">
        <button className="p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200">
          <Grid size={20} />
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200">
          <FileText size={20} />
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200">
          <MessageSquare size={20} />
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200">
          <Zap size={20} />
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200">
          <Settings size={20} />
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-200">
          <Database size={20} />
        </button>
      </div>

      {/* Secondary Sidebar */}
      <div className="w-64 border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200 flex items-center gap-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder-gray-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3">
            <div className="flex items-center text-xs font-semibold text-gray-500 mb-2 tracking-wider">
              <ChevronDown size={14} className="mr-1" />
              CONNECTED
            </div>

            <div className="space-y-1">
              {appState.map((app, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedProvider(app.name)}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-md text-sm ${app.name === selectedProvider ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  <div className="flex items-center gap-3">
                    <app.icon size={16} className={`${app.name === selectedProvider ? '' : app.color}`} />
                    <span className={app.name === selectedProvider ? 'font-medium' : ''}>{app.name}</span>
                  </div>
                  {app.connected && (
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-gray-200 flex items-center px-6 justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 text-sm text-gray-600">
                <MessageSquare size={16} className="text-blue-500" />
                <span>{selectedProvider}</span>
                <Plus size={16} className="text-gray-400 ml-1" />
             </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleCreateSession}
              disabled={agents.length === 0}
              className={`text-sm font-medium text-white px-3 py-1.5 rounded-md flex items-center gap-1 shadow-sm transition-colors ${agents.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'}`}
            >
              <Plus size={16} /> New Session
            </button>
            <span className="text-sm font-medium">Glass</span>
            <div className="flex gap-2">
               <button className="text-gray-400 hover:text-gray-600"><MonitorPlay size={18}/></button>
               <button className="text-gray-400 hover:text-gray-600"><Settings size={18}/></button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        {activeSessions.length > 0 ? (
          <div className="flex-1 flex flex-row h-full w-full overflow-x-auto">
            {activeSessions.map((session) => (
              <ChatWindow
                key={session.id}
                sessionId={session.id}
                onClose={handleCloseSession}
                defaultPosition={{ x: session.x, y: session.y }}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl">
            <div className="flex items-start justify-between mb-8">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <MessageSquare size={28} className="text-blue-500" />
                  <h1 className="text-2xl font-semibold">{selectedProvider}</h1>
                  {selectedApp.connected && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200 ml-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                      Connected
                    </div>
                  )}
                </div>
                <p className="text-gray-500 text-sm max-w-2xl mt-4">
                  Search messages, access channels, read threads, and stay connected with your team's
                  communications. Find relevant discussions and context quickly.
                </p>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical size={20} />
              </button>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-1">Tool permissions</h2>
              <p className="text-sm text-gray-500 mb-6">Choose when the agent is allowed to use these tools.</p>

              {/* Read-Only Tools */}
              <div className="mb-8">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-4 border-b border-gray-100 pb-2">
                  <div className="flex items-center tracking-wider">
                    <ChevronDown size={14} className="mr-1" />
                    READ-ONLY TOOLS
                  </div>
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-600">
                    Allow <ChevronDown size={14} />
                  </div>
                </div>
                <div className="space-y-0">
                  {readOnlyTools.map((tool, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-700">{tool.name}</span>
                      <PermissionToggle status={tool.status} onToggle={(newStatus) => handleToggle(tool.name, newStatus, 'read_only')} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Write/Delete Tools */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-4 border-b border-gray-100 pb-2">
                  <div className="flex items-center tracking-wider">
                    <ChevronDown size={14} className="mr-1" />
                    WRITE/DELETE TOOLS
                  </div>
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-600">
                    Mixed <ChevronDown size={14} />
                  </div>
                </div>
                <div className="space-y-0">
                  {writeDeleteTools.map((tool, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                      <span className="text-sm text-gray-700">{tool.name}</span>
                      <PermissionToggle status={tool.status} onToggle={(newStatus) => handleToggle(tool.name, newStatus, 'write_delete')} />
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
