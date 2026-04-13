import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { app } from './index';
import type { Bindings } from './index';

vi.mock('jose', () => ({
  createRemoteJWKSet: vi.fn(() => 'mock-jwks'),
  jwtVerify: vi.fn(),
}));

import { jwtVerify } from 'jose';

const mockDb = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      run: vi.fn().mockResolvedValue({}),
    }),
  }),
};

const baseEnv = {
  OKTA_DOMAIN: 'example.okta.com',
  OKTA_CLIENT_ID: 'test-client-id',
  DB: mockDb,
} as unknown as Bindings;

const makeRequest = (token: string) =>
  new Request('http://localhost/mcp/tools/google_drive/Send%20message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ permission: 'allow' }),
  });

describe('POST /mcp/tools/:provider/:tool_name – admin authorization', () => {
  beforeEach(() => {
    vi.mocked(jwtVerify).mockReset();
    mockDb.prepare.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 403 when the user has no roles', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-abc' },
    } as any);

    const res = await app.fetch(makeRequest('token-no-roles'), baseEnv, {} as any);

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toBe('Forbidden: Admin access required');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('returns 403 when the user has only non-admin roles', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-abc', groups: ['viewer', 'editor'] },
    } as any);

    const res = await app.fetch(makeRequest('token-non-admin'), baseEnv, {} as any);

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toBe('Forbidden: Admin access required');
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it('returns 403 when the roles claim is a string instead of an array (no substring match)', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-abc', groups: 'superadmin' },
    } as any);

    const res = await app.fetch(makeRequest('token-string-role'), baseEnv, {} as any);

    expect(res.status).toBe(403);
    const body = await res.json() as any;
    expect(body.error).toBe('Forbidden: Admin access required');
  });

  it('returns 200 when the user has the admin role', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-abc', groups: ['admin'] },
    } as any);

    const res = await app.fetch(makeRequest('token-admin'), baseEnv, {} as any);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(mockDb.prepare).toHaveBeenCalledOnce();
  });

  it('returns 400 for an invalid permission value even as admin', async () => {
    vi.mocked(jwtVerify).mockResolvedValueOnce({
      payload: { sub: 'user-abc', groups: ['admin'] },
    } as any);

    const req = new Request('http://localhost/mcp/tools/google_drive/some_tool', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-admin',
      },
      body: JSON.stringify({ permission: 'delete_everything' }),
    });

    const res = await app.fetch(req, baseEnv, {} as any);

    expect(res.status).toBe(400);
    const body = await res.json() as any;
    expect(body.error).toBe('Invalid permission');
  });
});
