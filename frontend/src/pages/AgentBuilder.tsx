import React, { useState, useEffect } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AgentBuilder() {
  const { authState } = useOktaAuth();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [model, setModel] = useState('claude-3-5-sonnet-20241022');
  const [description, setDescription] = useState('');
  const [mcpServers, setMcpServers] = useState<{ url: string }[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);

  useEffect(() => {
    fetchAgents();
  }, [authState]);

  const fetchAgents = async () => {
    if (!authState?.isAuthenticated) return;

    try {
      const response = await fetch('/api/agents', {
        headers: {
          Authorization: `Bearer ${authState.accessToken?.accessToken}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        setAgents(data.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authState?.isAuthenticated) return;

    const payload = {
      name,
      model,
      description,
      mcp_servers: mcpServers,
      version: editingId ? editingVersion : undefined
    };

    const url = editingId ? `/api/agents/${editingId}` : '/api/agents';
    const method = editingId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authState.accessToken?.accessToken}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        // Reset form
        setName('');
        setModel('claude-3-5-sonnet-20241022');
        setDescription('');
        setMcpServers([]);
        setEditingId(null);
        setEditingVersion(null);
        fetchAgents();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (agent: any) => {
    setEditingId(agent.id);
    setEditingVersion(agent.version || null); // Assuming version is passed back
    setName(agent.name || '');
    setModel(agent.model || 'claude-3-5-sonnet-20241022');
    setDescription(agent.description || '');
    setMcpServers(agent.mcp_servers || []);
  };

  const addMcpServer = () => {
    setMcpServers([...mcpServers, { url: '' }]);
  };

  const updateMcpServer = (index: number, url: string) => {
    const updated = [...mcpServers];
    updated[index] = { url };
    setMcpServers(updated);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit Agent' : 'Create Agent'}</CardTitle>
          <CardDescription>Define system prompts and select MCP servers.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Select value={model} onValueChange={(val) => setModel(val || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">System Prompt / Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>MCP Servers</Label>
                <Button type="button" variant="outline" size="sm" onClick={addMcpServer}>Add Server</Button>
              </div>
              {mcpServers.map((server, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    placeholder="MCP Server URL"
                    value={server.url}
                    onChange={(e) => updateMcpServer(idx, e.target.value)}
                  />
                  <Button type="button" variant="destructive" size="sm" onClick={() => {
                    const updated = [...mcpServers];
                    updated.splice(idx, 1);
                    setMcpServers(updated);
                  }}>Remove</Button>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit">{editingId ? 'Update' : 'Create'}</Button>
            {editingId && (
              <Button type="button" variant="ghost" className="ml-2" onClick={() => {
                setEditingId(null);
                setName('');
                setDescription('');
                setMcpServers([]);
              }}>Cancel</Button>
            )}
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Agents</CardTitle>
          <CardDescription>Select an agent to edit.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading agents...</p>
          ) : agents.length === 0 ? (
            <p>No agents found.</p>
          ) : (
            <ul className="space-y-4">
              {agents.map(agent => (
                <li key={agent.id} className="border p-4 rounded-md flex justify-between items-center">
                  <div>
                    <h3 className="font-bold">{agent.name}</h3>
                    <p className="text-sm text-gray-500">{agent.model}</p>
                  </div>
                  <Button variant="outline" onClick={() => handleEdit(agent)}>Edit</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
