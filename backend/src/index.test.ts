import { describe, it, expect } from 'vitest';
import { getOktaIssuer, normalizeOktaDomain, normalizeIssuer } from './index';

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
});
