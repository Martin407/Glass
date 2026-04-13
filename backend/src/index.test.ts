import { describe, it, expect } from 'vitest';
import { normalizeIssuer } from './index';

describe('normalizeIssuer', () => {
  it('should normalize valid URLs without trailing slashes', () => {
    expect(normalizeIssuer('https://example.com/oauth2/default')).toBe('https://example.com/oauth2/default');
    expect(normalizeIssuer('https://example.com/oauth2/default/')).toBe('https://example.com/oauth2/default');
    expect(normalizeIssuer('  https://example.com/oauth2/default//  ')).toBe('https://example.com/oauth2/default');
  });

  it('should throw an error for invalid URLs', () => {
    expect(() => normalizeIssuer('not-a-url')).toThrow('OKTA_ISSUER must be a valid URL');
    expect(() => normalizeIssuer('')).toThrow('OKTA_ISSUER must be a valid URL');
  });

  it('should throw an error if URL contains a query', () => {
    expect(() => normalizeIssuer('https://example.com/oauth2/default?foo=bar')).toThrow('OKTA_ISSUER must not include a query or fragment');
  });

  it('should throw an error if URL contains a fragment', () => {
    expect(() => normalizeIssuer('https://example.com/oauth2/default#hash')).toThrow('OKTA_ISSUER must not include a query or fragment');
  });
});
