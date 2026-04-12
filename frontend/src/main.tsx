import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { Security } from '@okta/okta-react'
import { OktaAuth, toRelativeUrl } from '@okta/okta-auth-js'
import './index.css'
import App from './App.tsx'

const issuer = import.meta.env.VITE_OKTA_ISSUER;
const clientId = import.meta.env.VITE_OKTA_CLIENT_ID;

if (!issuer || !clientId) {
  throw new Error("Missing VITE_OKTA_ISSUER or VITE_OKTA_CLIENT_ID environment variables.");
}

const oktaAuth = new OktaAuth({
  issuer,
  clientId,
  redirectUri: window.location.origin + '/login/callback',
  scopes: ['openid', 'profile', 'email'],
  pkce: true,
})

function Root() {
  const navigate = useNavigate();

  const restoreOriginalUri = async (_oktaAuth: OktaAuth, originalUri: string) => {
    navigate(toRelativeUrl(originalUri || '/', window.location.origin));
  };

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      <App />
    </Security>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
)
