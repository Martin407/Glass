import { useOktaAuth } from '@okta/okta-react';

export default function Login() {
  const { oktaAuth } = useOktaAuth();

  const login = async () => {
    await oktaAuth.signInWithRedirect();
  };

  return (
    <div>
      <h1>Login</h1>
      <button onClick={login}>Sign In</button>
    </div>
  );
}
