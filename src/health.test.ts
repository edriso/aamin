import { describe, it, expect } from 'vitest';
import { resolvePort } from './health';

describe('resolvePort', () => {
  it('falls back to 8080 for an empty or undefined value', () => {
    // .env.example ships PORT="" so the blank case must default cleanly.
    expect(resolvePort('')).toBe(8080);
    expect(resolvePort('   ')).toBe(8080);
    expect(resolvePort(undefined)).toBe(8080);
  });

  it('parses a valid port', () => {
    expect(resolvePort('3000')).toBe(3000);
    expect(resolvePort(' 8443 ')).toBe(8443);
  });

  it('rejects out-of-range ports', () => {
    expect(resolvePort('0')).toBe(8080);
    expect(resolvePort('70000')).toBe(8080);
  });

  it('rejects non-digit formats (float, hex, trailing text)', () => {
    expect(resolvePort('30.5')).toBe(8080);
    expect(resolvePort('0x1f90')).toBe(8080);
    expect(resolvePort('3000abc')).toBe(8080);
  });
});
