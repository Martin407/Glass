import { describe, it, expect } from 'vitest';
import { normalizeOktaDomain } from './index';

describe('normalizeOktaDomain', () => {
  it('should handle valid hostnames without protocols', () => {
    expect(normalizeOktaDomain('example.okta.com')).toBe('example.okta.com');
    expect(normalizeOktaDomain('dev-123456.okta.com')).toBe('dev-123456.okta.com');
  });

  it('should handle valid URLs with protocols', () => {
    expect(normalizeOktaDomain('https://example.okta.com')).toBe('example.okta.com');
    expect(normalizeOktaDomain('http://example.okta.com')).toBe('example.okta.com');
  });

  it('should trim whitespace around valid inputs', () => {
    expect(normalizeOktaDomain('  example.okta.com  ')).toBe('example.okta.com');
    expect(normalizeOktaDomain('\t https://example.okta.com \n')).toBe('example.okta.com');
  });

  it('should throw an error for invalid domain strings', () => {
    expect(() => normalizeOktaDomain('not a valid domain')).toThrow('OKTA_DOMAIN must be a valid domain or URL');
    // Technically `http://not a valid domain` is caught by new URL()
    expect(() => normalizeOktaDomain('http://not a valid domain')).toThrow('OKTA_DOMAIN must be a valid domain or URL');
  });

  it('should throw an error for domains with paths, query strings, or fragments', () => {
    expect(() => normalizeOktaDomain('example.okta.com/path')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
    expect(() => normalizeOktaDomain('https://example.okta.com/oauth2/default')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
    expect(() => normalizeOktaDomain('example.okta.com?query=1')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
    expect(() => normalizeOktaDomain('example.okta.com#fragment')).toThrow('OKTA_DOMAIN must not include a path, query, or fragment');
  });
});
