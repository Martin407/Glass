import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isConstraintError } from '../index.js';

describe('isConstraintError', () => {
  test('returns true when error.code is string "19"', () => {
    assert.strictEqual(isConstraintError({ code: '19' }), true);
  });

  test('returns true when error.code is number 19', () => {
    assert.strictEqual(isConstraintError({ code: 19 }), true);
  });

  test('returns true when error.cause.code is "19"', () => {
    assert.strictEqual(isConstraintError({ cause: { code: '19' } }), true);
  });

  test('returns true when error.cause.code is 19', () => {
    assert.strictEqual(isConstraintError({ cause: { code: 19 } }), true);
  });

  test('returns true when error.code starts with SQLITE_CONSTRAINT', () => {
    assert.strictEqual(isConstraintError({ code: 'SQLITE_CONSTRAINT_UNIQUE' }), true);
    assert.strictEqual(isConstraintError({ code: 'SQLITE_CONSTRAINT_FOREIGNKEY' }), true);
  });

  test('returns true when error.cause.code starts with SQLITE_CONSTRAINT', () => {
    assert.strictEqual(isConstraintError({ cause: { code: 'SQLITE_CONSTRAINT_UNIQUE' } }), true);
    assert.strictEqual(isConstraintError({ cause: { code: 'SQLITE_CONSTRAINT_FOREIGNKEY' } }), true);
  });

  test('returns false for irrelevant error codes', () => {
    assert.strictEqual(isConstraintError({ code: '404' }), false);
    assert.strictEqual(isConstraintError({ code: 500 }), false);
    assert.strictEqual(isConstraintError({ cause: { code: 'SQLITE_ERROR' } }), false);
  });

  test('returns false for null, undefined, empty object, or strings', () => {
    assert.strictEqual(isConstraintError(null), false);
    assert.strictEqual(isConstraintError(undefined), false);
    assert.strictEqual(isConstraintError({}), false);
    assert.strictEqual(isConstraintError('string error'), false);
    assert.strictEqual(isConstraintError({ message: 'SQLITE_CONSTRAINT' }), false); // only checks code
  });
});
