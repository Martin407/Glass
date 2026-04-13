import { describe, it, expect } from 'vitest';
import { isConstraintError } from '../index.js';

describe('isConstraintError', () => {
  it('returns true when error.code is string "19"', () => {
    expect(isConstraintError({ code: '19' })).toBe(true);
  });

  it('returns true when error.code is number 19', () => {
    expect(isConstraintError({ code: 19 })).toBe(true);
  });

  it('returns true when error.cause.code is "19"', () => {
    expect(isConstraintError({ cause: { code: '19' } })).toBe(true);
  });

  it('returns true when error.cause.code is 19', () => {
    expect(isConstraintError({ cause: { code: 19 } })).toBe(true);
  });

  it('returns true when error.code starts with SQLITE_CONSTRAINT', () => {
    expect(isConstraintError({ code: 'SQLITE_CONSTRAINT_UNIQUE' })).toBe(true);
    expect(isConstraintError({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' })).toBe(true);
    expect(isConstraintError({ code: 'sQlItE_cOnStRaInT_check' })).toBe(true);
  });

  it('returns true when error.cause.code starts with SQLITE_CONSTRAINT', () => {
    expect(isConstraintError({ cause: { code: 'SQLITE_CONSTRAINT_UNIQUE' } })).toBe(true);
    expect(isConstraintError({ cause: { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' } })).toBe(true);
    expect(isConstraintError({ cause: { code: 'sqlite_constraint_notnull' } })).toBe(true);
  });

  it('returns false for irrelevant error codes', () => {
    expect(isConstraintError({ code: '404' })).toBe(false);
    expect(isConstraintError({ code: 500 })).toBe(false);
    expect(isConstraintError({ cause: { code: 'SQLITE_ERROR' } })).toBe(false);
  });

  it('returns false for null, undefined, empty object, or strings', () => {
    expect(isConstraintError(null)).toBe(false);
    expect(isConstraintError(undefined)).toBe(false);
    expect(isConstraintError({})).toBe(false);
    expect(isConstraintError('string error')).toBe(false);
    expect(isConstraintError({ message: 'SQLITE_CONSTRAINT' })).toBe(false); // only checks code
  });
});
