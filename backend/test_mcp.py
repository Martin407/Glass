import requests

def test_connections():
    res = requests.get('http://localhost:8787/mcp/connections')
    assert res.status_code == 200
    data = res.json()
    assert 'Slack' in data['connections']
    print("test_connections passed")

def test_tools():
    res = requests.get('http://localhost:8787/mcp/tools/Slack')
    assert res.status_code == 200
    data = res.json()
    assert 'read_only' in data
    assert 'write_delete' in data
    print("test_tools passed")

def test_update_permission():
    res = requests.post('http://localhost:8787/mcp/tools/Slack/Send%20message', json={"permission": "deny"})
    assert res.status_code == 200
    assert res.json() == {"success": True}

    res2 = requests.get('http://localhost:8787/mcp/tools/Slack')
    data = res2.json()
    send_msg = next(t for t in data['write_delete'] if t['name'] == 'Send message')
    assert send_msg['status'] == 'Deny'
    print("test_update_permission passed")

if __name__ == '__main__':
    test_connections()
    test_tools()
    test_update_permission()
    print("All backend MCP tests passed!")
