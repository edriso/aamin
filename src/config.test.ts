import { describe, it, expect } from 'vitest';
import { channelUrlFrom, validateTimezone, channelIdHint } from './config';

describe('channelUrlFrom', () => {
  it('builds a t.me link from an @username', () => {
    expect(channelUrlFrom('@my_channel')).toBe('https://t.me/my_channel');
  });

  it('rejects an @username that is too short or has bad chars', () => {
    expect(channelUrlFrom('@ab')).toBeNull();
    expect(channelUrlFrom('@bad-handle!')).toBeNull();
  });

  it('normalizes a plain or http t.me URL to https', () => {
    expect(channelUrlFrom('t.me/abc')).toBe('https://t.me/abc');
    expect(channelUrlFrom('http://t.me/abc')).toBe('https://t.me/abc');
    expect(channelUrlFrom('https://t.me/abc')).toBe('https://t.me/abc');
  });

  it('keeps an invite-link slug path as-is under https', () => {
    expect(channelUrlFrom('https://t.me/+oPN5XjvvARNjYzc0')).toBe('https://t.me/+oPN5XjvvARNjYzc0');
  });

  it('returns null for a numeric -100... id (no derivable public link)', () => {
    expect(channelUrlFrom('-1001234567890')).toBeNull();
  });
});

describe('validateTimezone', () => {
  it('returns the name for a valid IANA timezone', () => {
    expect(validateTimezone('Africa/Cairo')).toBe('Africa/Cairo');
    expect(validateTimezone('Asia/Riyadh')).toBe('Asia/Riyadh');
    expect(validateTimezone('UTC')).toBe('UTC');
  });

  it('throws on an invalid timezone name', () => {
    expect(() => validateTimezone('Mars/Phobos')).toThrow(/Invalid IANA timezone/);
    expect(() => validateTimezone('not-a-tz')).toThrow(/Invalid IANA timezone/);
  });
});

describe('channelIdHint', () => {
  it('returns null for a correct -100... id or @username', () => {
    expect(channelIdHint('-1003723418314')).toBeNull();
    expect(channelIdHint('@mychannel')).toBeNull();
  });

  it('catches the common missing-leading-minus mistake', () => {
    // This is exactly the real-world bug: 1003723418314 instead of -100...
    const hint = channelIdHint('1003723418314');
    expect(hint).toContain('-1003723418314');
    expect(hint).toMatch(/missing the leading/);
  });

  it('flags an invite link or slug', () => {
    expect(channelIdHint('https://t.me/+oPN5XjvvARNjYzc0')).toMatch(/invite link/);
    expect(channelIdHint('+oPN5XjvvARNjYzc0')).toMatch(/invite link/);
  });

  it('flags other numeric ids that are not channel-shaped', () => {
    expect(channelIdHint('12345')).toMatch(/does not look like a channel id/);
  });
});
