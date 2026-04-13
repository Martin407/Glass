import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from './index';
import type { Bindings } from './index';

describe('Auth Middleware Config Leak Prevention', () => {
  beforeEach(() => {
    vi.stubGlobal('console', {
      ...console,
      error: vi.fn(), // Mock console.error to track calls
    });
  });

  it('should return a generic 500 without leaking config details when OKTA_DOMAIN is missing', async () => {
    const env = {
      // Intentionally omitting OKTA_DOMAIN and AUTH_BYPASS_FOR_DEV
    } as unknown as Bindings;

    const req = new Request('http://localhost/api/test', {
      method: 'GET',
    });

    const res = await app.fetch(req, env, {} as any);

    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toBe('Authentication is misconfigured');
    expect(body).not.toHaveProperty('OKTA_DOMAIN');

    // Check that the error details were actually logged to console.error
    expect(console.error).toHaveBeenCalledWith('Authentication is misconfigured: OKTA_DOMAIN is required');
  });

  it('should return a generic 500 without leaking config details when OKTA_ISSUER is invalid', async () => {
    const env = {
      OKTA_DOMAIN: 'example.okta.com',
      OKTA_ISSUER: 'not-a-url', // This will cause getOktaIssuer to throw
    } as unknown as Bindings;

    const req = new Request('http://localhost/api/test', {
      method: 'GET',
    });

    const res = await app.fetch(req, env, {} as any);

    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toBe('Authentication is misconfigured');
    expect(JSON.stringify(body)).not.toContain('OKTA_ISSUER');

    // Check that the error details were actually logged to console.error
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('OKTA_ISSUER must be a valid URL'), expect.any(Error));
  });

  it('should return a generic 500 without leaking config details when OKTA_AUDIENCE/CLIENT_ID is missing', async () => {
    const env = {
      OKTA_DOMAIN: 'example.okta.com',
      OKTA_ISSUER: 'https://example.okta.com/oauth2/default',
      // Intentionally omitting OKTA_AUDIENCE and OKTA_CLIENT_ID
    } as unknown as Bindings;

    const req = new Request('http://localhost/api/test', {
      method: 'GET',
    });

    const res = await app.fetch(req, env, {} as any);

    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toBe('Authentication is misconfigured');
    expect(JSON.stringify(body)).not.toContain('OKTA_AUDIENCE');
    expect(JSON.stringify(body)).not.toContain('OKTA_CLIENT_ID');

    // Check that the error details were actually logged to console.error
    expect(console.error).toHaveBeenCalledWith('Authentication is misconfigured: OKTA_AUDIENCE or OKTA_CLIENT_ID is required');
  });
});
