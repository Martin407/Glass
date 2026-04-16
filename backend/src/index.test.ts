import { describe, it, expect, vi } from 'vitest';
import { getOktaAudience, getOktaIssuer, normalizeOktaDomain, normalizeIssuer, parseAnthropicError, handleAnthropicError, archiveUpstreamResource } from './index';

describe('Anthropic Error Handling Utilities', () => {
  describe('parseAnthropicError', () => {
    it('should extract error message from valid JSON', async () => {
      const response = new Response(JSON.stringify({ error: { message: 'Custom API Error' } }), {
        status: 400,
        statusText: 'Bad Request'
      });
      const result = await parseAnthropicError(response);
      expect(result).toBe('Custom API Error');
    });

    it('should fallback to status info if JSON parsing fails', async () => {
      const response = new Response('Not a JSON string', {
        status: 500,
        statusText: 'Internal Server Error'
      });
      const result = await parseAnthropicError(response);
      expect(result).toBe('Anthropic API Error: 500 Internal Server Error');
    });

    it('should fallback to status info if JSON has no error message', async () => {
      const response = new Response(JSON.stringify({ someData: 'value' }), {
        status: 403,
        statusText: 'Forbidden'
      });
      const result = await parseAnthropicError(response);
      expect(result).toBe('Anthropic API Error: 403 Forbidden');
    });
  });

  describe('handleAnthropicError', () => {
    it('should return a JSON response with status and parsed message', async () => {
      const c = {
        json: (data: any, status: any) => ({ data, status })
      } as any;
      const response = new Response(JSON.stringify({ error: { message: 'Auth failed' } }), {
        status: 401,
        statusText: 'Unauthorized'
      });

      const result = await handleAnthropicError(c, response);
      expect(result).toEqual({
        data: { error: 'Auth failed' },
        status: 401
      });
    });
  });
});

describe('Okta Issuer Configuration', () => {
  describe('normalizeOktaDomain', () => {
    it('should normalize a plain domain', () => {
      expect(normalizeOktaDomain('example.okta.com')).toBe('example.okta.com');
    });

    it('should normalize a domain with https://', () => {
      expect(normalizeOktaDomain('https://example.okta.com')).toBe('example.okta.com');
    });

    it('should trim whitespace', () => {
      expect(normalizeOktaDomain('  example.okta.com  ')).toBe('example.okta.com');
    });

    it('should throw if a path is included', () => {
      expect(() => normalizeOktaDomain('example.okta.com/path')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
    });

    it('should throw if a query is included', () => {
      expect(() => normalizeOktaDomain('example.okta.com?query=1')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
    });

    it('should throw if a fragment is included', () => {
      expect(() => normalizeOktaDomain('example.okta.com#fragment')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
    });
  });

  describe('normalizeIssuer', () => {
    it('should normalize a valid issuer URL', () => {
      expect(normalizeIssuer('https://example.okta.com/oauth2/default')).toBe('https://example.okta.com/oauth2/default');
    });

    it('should remove trailing slashes', () => {
      expect(normalizeIssuer('https://example.okta.com/oauth2/default/')).toBe('https://example.okta.com/oauth2/default');
      expect(normalizeIssuer('https://example.okta.com/oauth2/default//')).toBe('https://example.okta.com/oauth2/default');
    });

    it('should trim whitespace', () => {
      expect(normalizeIssuer('  https://example.okta.com/oauth2/default  ')).toBe('https://example.okta.com/oauth2/default');
    });

    it('should throw if it is an invalid URL', () => {
      expect(() => normalizeIssuer('not-a-url')).toThrow('OKTA_ISSUER must be a valid URL');
    });

    it('should throw if a query is included', () => {
      expect(() => normalizeIssuer('https://example.okta.com/oauth2/default?query=1')).toThrow('OKTA_ISSUER must not include a query or fragment');
    });

    it('should throw if a fragment is included', () => {
      expect(() => normalizeIssuer('https://example.okta.com/oauth2/default#fragment')).toThrow('OKTA_ISSUER must not include a query or fragment');
    });
  });

  describe('getOktaIssuer', () => {
    it('should return default issuer when no configuredIssuer is provided', () => {
      expect(getOktaIssuer('example.okta.com')).toBe('https://example.okta.com/oauth2/default');
    });

    it('should return default issuer for domains with scheme when no configuredIssuer is provided', () => {
      expect(getOktaIssuer('https://example.okta.com')).toBe('https://example.okta.com/oauth2/default');
    });

    it('should use configuredIssuer if provided', () => {
      expect(getOktaIssuer('example.okta.com', 'https://custom.okta.com/oauth2/custom')).toBe('https://custom.okta.com/oauth2/custom');
    });

    it('should use configuredIssuer and strip trailing slashes', () => {
      expect(getOktaIssuer('example.okta.com', 'https://custom.okta.com/oauth2/custom/')).toBe('https://custom.okta.com/oauth2/custom');
    });

    it('should throw if configuredIssuer is invalid', () => {
      expect(() => getOktaIssuer('example.okta.com', 'not-a-url')).toThrow('OKTA_ISSUER must be a valid URL');
    });

    it('should throw if domain is invalid and configuredIssuer is not provided', () => {
      expect(() => getOktaIssuer('example.okta.com/path')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
    });
  });

  describe('getOktaAudience', () => {
    it('should return configuredAudience if it is provided', () => {
      expect(getOktaAudience('custom-audience', 'client-id-123')).toBe('custom-audience');
      expect(getOktaAudience('custom-audience')).toBe('custom-audience');
    });

    it('should return clientId if configuredAudience is undefined', () => {
      expect(getOktaAudience(undefined, 'client-id-123')).toBe('client-id-123');
    });

    it('should return undefined if both are undefined', () => {
      expect(getOktaAudience(undefined, undefined)).toBeUndefined();
      expect(getOktaAudience()).toBeUndefined();
    });
  });
});

describe('archiveUpstreamResource', () => {
  it('should fall back to a specific error string when upstream JSON parsing fails', async () => {
    // Create a mock context with user matching the expected shape { id: string }
    const c = {
      get: (key: string) => {
        if (key === 'user') return { id: 'test-okta-id' };
        return null;
      },
      env: {
        ANTHROPIC_API_KEY: 'test-api-key'
      }
    } as any;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
    }));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await archiveUpstreamResource(c, 'agents', 'agent-123', 'Test error context');

      expect(fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/agents/agent-123/archive',
        expect.objectContaining({ method: 'POST' })
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Test error context: upstream archive failed with 502',
        'Unable to parse upstream archive error response'
      );
    } finally {
      vi.unstubAllGlobals();
      consoleErrorSpy.mockRestore();
    }
  });
});
