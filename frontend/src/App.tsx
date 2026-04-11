import { useEffect, useState } from 'react';
import { Routes, Route, Link, Outlet } from 'react-router-dom';
import { LoginCallback, useOktaAuth } from '@okta/okta-react';
import { toRelativeUrl } from '@okta/okta-auth-js';
import Dashboard from './pages/Dashboard';
import AgentBuilder from './pages/AgentBuilder';
import SessionView from './pages/SessionView';
import Login from './pages/Login';
import MockAgentBuilder from './pages/MockAgentBuilder';
import './App.css';

import { setAccessTokenProvider } from './lib/agentsApi';

const RequiredAuth = () => {
  const { oktaAuth, authState } = useOktaAuth();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!authState) {
      return;
    }

    if (!authState?.isAuthenticated && !redirecting) {
      setRedirecting(true);
      const originalUri = toRelativeUrl(window.location.href, window.location.origin);
      oktaAuth.setOriginalUri(originalUri);
      oktaAuth.signInWithRedirect();
    } else if (authState?.isAuthenticated) {
      setAccessTokenProvider(() => authState.accessToken?.accessToken);
    }
  }, [oktaAuth, authState, authState?.isAuthenticated, redirecting]);

  if (!authState || !authState?.isAuthenticated) {
    return <div>Loading...</div>;
  }

  return <Outlet />;
};

function App() {
  return (
    <div>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc', marginBottom: '20px' }}>
        <ul style={{ display: 'flex', gap: '20px', listStyle: 'none', margin: 0, padding: 0 }}>
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/builder">Agent Builder</Link></li>
          <li><Link to="/session/123">Session View</Link></li>
        </ul>
      </nav>

      <main style={{ padding: '20px' }}>
        <Routes>
          <Route element={<RequiredAuth />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/builder" element={<AgentBuilder />} />
            <Route path="/session/:id" element={<SessionView />} />
          </Route>

          <Route path="/mockbuilder" element={<MockAgentBuilder />} />
          <Route path="/login" element={<Login />} />
          <Route path="/login/callback" element={<LoginCallback />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
