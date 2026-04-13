import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility function', () => {
  it('should merge basic class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle tailwind class conflicts correctly', () => {
    // p-4 should be overwritten by p-8
    expect(cn('p-4', 'p-8')).toBe('p-8');

    // text-red-500 should be overwritten by text-blue-500
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should handle conditional classes using objects', () => {
    expect(cn('base-class', { 'active': true, 'disabled': false })).toBe('base-class active');
  });

  it('should handle undefined and null values', () => {
    expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2');
  });

  it('should handle falsy values (false, 0, empty string)', () => {
    expect(cn('class1', false, 0, '', 'class2')).toBe('class1 class2');
  });

  it('should handle nested arrays', () => {
    expect(cn(['class1', ['class2', 'class3']], 'class4')).toBe('class1 class2 class3 class4');
  });

  it('should handle arrays of class names', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });

  it('should handle a mix of inputs', () => {
    const isActive = true;
    expect(cn(
      'p-4 bg-red-500',
      isActive && 'text-white',
      { 'opacity-50': !isActive },
      ['rounded-md', 'shadow-lg'],
      'p-8' // This should override p-4
    )).toBe('bg-red-500 text-white rounded-md shadow-lg p-8');
  });
});
