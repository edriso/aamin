import { describe, it, expect } from 'vitest';
import { morningReminders } from './morningReminders';
import { fridayFamily } from './fridayFamily';
import { welcomeMessage } from './welcome';
import { pickForDay } from '../lib/pick';

// Telegram single-message hard limit. Our messages are far shorter, but
// guard against a future edit that accidentally pastes a huge block.
const MAX_MESSAGE = 4096;

describe('morningReminders', () => {
  it('has a healthy pool of tips (room for ~a month without repeats)', () => {
    expect(morningReminders.length).toBeGreaterThanOrEqual(28);
  });

  it('every tip is non-blank and within the Telegram message limit', () => {
    for (const tip of morningReminders) {
      expect(tip.trim().length).toBeGreaterThan(0);
      expect(tip.length).toBeLessThanOrEqual(MAX_MESSAGE);
      // Keep them short and morning-friendly, not walls of text.
      expect(tip.length).toBeLessThanOrEqual(900);
    }
  });

  it('has no duplicate tips', () => {
    expect(new Set(morningReminders).size).toBe(morningReminders.length);
  });

  it('daily rotation never shows the same tip on consecutive days (over a full year)', () => {
    let day = new Date('2026-01-01T07:00:00Z');
    for (let i = 0; i < 366; i++) {
      const next = new Date(day.getTime() + 86_400_000);
      expect(pickForDay(morningReminders, day, 'Africa/Cairo')).not.toBe(
        pickForDay(morningReminders, next, 'Africa/Cairo'),
      );
      day = next;
    }
  });
});

describe('fridayFamily', () => {
  it('is non-blank and within the message limit', () => {
    expect(fridayFamily.trim().length).toBeGreaterThan(0);
    expect(fridayFamily.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });
});

describe('welcomeMessage', () => {
  it('is non-blank and within the message limit', () => {
    expect(welcomeMessage.trim().length).toBeGreaterThan(0);
    expect(welcomeMessage.length).toBeLessThanOrEqual(MAX_MESSAGE);
  });
});
