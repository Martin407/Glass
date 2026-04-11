import { useState } from 'react';
import { agentsApi } from './lib/agentsApi';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('agents');
  const [output, setOutput] = useState<any>(null);

  const handleApiCall = async (apiFunc: () => Promise<any>) => {
    try {
      const result = await apiFunc();
      setOutput(result);
    } catch (err: any) {
      setOutput({ error: err.message });
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50 text-gray-900 font-sans">
      <h1 className="text-3xl font-bold mb-8 text-center text-blue-600">Managed Agents API Test Dashboard</h1>

      <div className="flex justify-center space-x-4 mb-8">
        {['agents', 'sessions', 'environments', 'events', 'resources'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 capitalize border-b pb-2">{activeTab} Operations</h2>
          <div className="space-y-3">
            {activeTab === 'agents' && (
              <>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.listAgents())}>List Agents</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.createAgent({ name: 'Test Agent', model: 'claude-3-7-sonnet-20250219' }))}>Create Agent</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.getAgent('ag_test'))}>Get Agent</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.updateAgent('ag_test', { name: 'Updated Agent' }))}>Update Agent</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-red-600" onClick={() => handleApiCall(() => agentsApi.archiveAgent('ag_test'))}>Archive Agent</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.getAgentVersions('ag_test'))}>Get Agent Versions</button>
              </>
            )}

            {activeTab === 'sessions' && (
              <>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.listSessions())}>List Sessions</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.createSession({ agent_id: 'ag_test' }))}>Create Session</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.getSession('sess_test'))}>Get Session</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.updateSession('sess_test', { title: 'Updated Session' }))}>Update Session</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-red-600" onClick={() => handleApiCall(() => agentsApi.deleteSession('sess_test'))}>Delete Session</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-orange-600" onClick={() => handleApiCall(() => agentsApi.archiveSession('sess_test'))}>Archive Session</button>
              </>
            )}

            {activeTab === 'environments' && (
              <>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.listEnvironments())}>List Environments</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.createEnvironment({ name: 'Test Env' }))}>Create Environment</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.getEnvironment('env_test'))}>Get Environment</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.updateEnvironment('env_test', { name: 'Updated Env' }))}>Update Environment</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-red-600" onClick={() => handleApiCall(() => agentsApi.deleteEnvironment('env_test'))}>Delete Environment</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-orange-600" onClick={() => handleApiCall(() => agentsApi.archiveEnvironment('env_test'))}>Archive Environment</button>
              </>
            )}

            {activeTab === 'events' && (
              <>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.listSessionEvents('sess_test'))}>List Events (Session: sess_test)</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.sendSessionEvent('sess_test', { events: [] }))}>Send Event (Session: sess_test)</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-blue-600" onClick={() => {
                  setOutput('Connecting to stream...');
                  const es = agentsApi.streamSessionEvents('sess_test');
                  es.onmessage = (e) => setOutput((prev: any) => ({ ...prev, [Date.now()]: JSON.parse(e.data) }));
                  es.onerror = () => setOutput((prev: any) => ({ ...prev, error: 'Stream error/closed' }));
                }}>Stream Events (Session: sess_test)</button>
              </>
            )}

            {activeTab === 'resources' && (
              <>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.listSessionResources('sess_test'))}>List Resources (Session: sess_test)</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.addSessionResource('sess_test', { file_id: 'file_test', type: 'file' }))}>Add Resource (Session: sess_test)</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.getSessionResource('sess_test', 'res_test'))}>Get Resource (Session: sess_test)</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors" onClick={() => handleApiCall(() => agentsApi.updateSessionResource('sess_test', 'res_test', { authorization_token: 'test' }))}>Update Resource</button>
                <button className="w-full text-left px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded border transition-colors text-red-600" onClick={() => handleApiCall(() => agentsApi.deleteSessionResource('sess_test', 'res_test'))}>Delete Resource (Session: sess_test)</button>
              </>
            )}
          </div>
        </div>

        <div className="bg-gray-900 rounded-xl shadow-sm border border-gray-800 overflow-hidden flex flex-col">
          <div className="bg-gray-800 px-4 py-2 border-b border-gray-700 flex justify-between items-center">
            <h2 className="text-sm font-semibold text-gray-200">Output</h2>
            <button className="text-xs text-gray-400 hover:text-white" onClick={() => setOutput(null)}>Clear</button>
          </div>
          <div className="p-4 overflow-auto flex-1 max-h-[600px]">
            <pre className="text-sm text-green-400 whitespace-pre-wrap break-all font-mono">
              {output ? JSON.stringify(output, null, 2) : 'No output yet. Click an operation to test.'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
