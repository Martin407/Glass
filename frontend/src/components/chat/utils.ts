import type { ErrorType } from './types';

export function extractText(content?: Array<{ type?: string; text?: string }>): string {
  if (!Array.isArray(content)) return '';
  return content
    .filter((b) => b?.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('');
}

export function formatInput(input?: Record<string, unknown>): string {
  if (!input) return '';
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function formatErrorType(t: ErrorType): string {
  return t.replace(/_/g, ' ').replace(/\berror\b/, '').trim();
}
