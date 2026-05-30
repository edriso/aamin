import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bot, Context } from 'grammy';
import { runSchedule } from './scheduler';
import { findSchedule } from './schedules';
import type { ScheduleDef } from './types';
import {
  _resetForTests as resetState,
  getLastMessageId,
  setLastMessageId,
  getMessageIds,
} from './lib/state';

/**
 * runSchedule must dispatch on `kind`: messages go through sendMessage,
 * polls go through sendPoll, and empty content posts nothing. No network.
 *
 * It must also implement replace-on-next-fire: a successful message post
 * updates the state pointer to the new message_id and deletes the
 * previously-tracked one. A failed post leaves state untouched so the
 * next fire can still clean up.
 */

function fakeBot() {
  const sendMessage = vi.fn().mockResolvedValue({ message_id: 11 });
  const sendPoll = vi.fn().mockResolvedValue({ message_id: 22 });
  const deleteMessage = vi.fn().mockResolvedValue(true);
  const bot = {
    api: { sendMessage, sendPoll, deleteMessage },
  } as unknown as Bot<Context>;
  return { bot, sendMessage, sendPoll, deleteMessage };
}

// Wipe the in-memory pointer store between cases so one test's posts
// can never trigger the next test's "delete previous" path.
beforeEach(() => {
  resetState();
});

describe('runSchedule dispatch', () => {
  it('a message schedule calls sendMessage, not sendPoll', async () => {
    const { bot, sendMessage, sendPoll } = fakeBot();
    const def = findSchedule('morning_reminder')!;
    expect(def.kind).toBe('message');
    const id = await runSchedule(bot, def);
    expect(id).toBe(11);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendPoll).not.toHaveBeenCalled();
  });

  it('the poll schedule calls sendPoll, not sendMessage', async () => {
    const { bot, sendMessage, sendPoll } = fakeBot();
    const def = findSchedule('evening_poll')!;
    expect(def.kind).toBe('poll');
    const id = await runSchedule(bot, def);
    expect(id).toBe(22);
    expect(sendPoll).toHaveBeenCalledTimes(1);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('a message schedule with empty array content posts nothing', async () => {
    const { bot, sendMessage, sendPoll } = fakeBot();
    const empty: ScheduleDef = {
      name: 'empty',
      kind: 'message',
      cron: '0 3 * * *',
      content: [],
    };
    const id = await runSchedule(bot, empty);
    expect(id).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(sendPoll).not.toHaveBeenCalled();
  });

  it('propagates a null result when the send fails', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('boom'));
    const sendPoll = vi.fn();
    const deleteMessage = vi.fn();
    const bot = {
      api: { sendMessage, sendPoll, deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('morning_reminder')!;
    await expect(runSchedule(bot, def)).resolves.toBeNull();
  });
});

describe('runSchedule replace-on-next-fire (messages)', () => {
  it('first fire posts and tracks the message_id but does NOT delete anything', async () => {
    const { bot, sendMessage, deleteMessage } = fakeBot();
    const def = findSchedule('morning_reminder')!;
    const id = await runSchedule(bot, def);
    expect(id).toBe(11);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('morning_reminder')).toBe(11);
  });

  it('second fire posts the new copy and deletes the previously-tracked one', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ message_id: 101 })
      .mockResolvedValueOnce({ message_id: 102 });
    const deleteMessage = vi.fn().mockResolvedValue(true);
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('morning_reminder')!;

    await runSchedule(bot, def);
    await runSchedule(bot, def);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(deleteMessage).toHaveBeenCalledTimes(1);
    expect(deleteMessage.mock.calls[0][1]).toBe(101);
    expect(getLastMessageId('morning_reminder')).toBe(102);

    // Post must happen before delete, never the other way around.
    const order =
      sendMessage.mock.invocationCallOrder[1] < deleteMessage.mock.invocationCallOrder[0];
    expect(order).toBe(true);
  });

  it('a failed post leaves the previous pointer intact for next time', async () => {
    await setLastMessageId('friday_family', 555);

    const sendMessage = vi.fn().mockRejectedValue(new Error('429'));
    const deleteMessage = vi.fn();
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('friday_family')!;

    await expect(runSchedule(bot, def)).resolves.toBeNull();

    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('friday_family')).toBe(555);
  });

  it('a failed delete still advances the pointer (best-effort cleanup)', async () => {
    await setLastMessageId('morning_reminder', 700);
    const sendMessage = vi.fn().mockResolvedValue({ message_id: 701 });
    const deleteMessage = vi.fn().mockRejectedValue(new Error('400 message to delete not found'));
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('morning_reminder')!;

    const id = await runSchedule(bot, def);

    expect(id).toBe(701);
    expect(deleteMessage).toHaveBeenCalledWith('@test_channel', 700);
    expect(getLastMessageId('morning_reminder')).toBe(701);
  });

  it('a skipIf guard posts nothing and leaves the ring buffer untouched', async () => {
    const { bot, sendMessage, deleteMessage } = fakeBot();
    await setLastMessageId('guarded', 900);
    const guarded: ScheduleDef = {
      name: 'guarded',
      kind: 'message',
      cron: '0 3 * * *',
      content: 'hello',
      skipIf: () => true,
    };

    await expect(runSchedule(bot, guarded)).resolves.toBeNull();

    expect(sendMessage).not.toHaveBeenCalled();
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('guarded')).toBe(900);
  });

  it('different schedules track their pointers independently', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ message_id: 1 }) // morning
      .mockResolvedValueOnce({ message_id: 2 }) // friday
      .mockResolvedValueOnce({ message_id: 3 }) // morning again
      .mockResolvedValueOnce({ message_id: 4 }); // friday again
    const deleteMessage = vi.fn().mockResolvedValue(true);
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;
    const morning = findSchedule('morning_reminder')!;
    const friday = findSchedule('friday_family')!;

    await runSchedule(bot, morning);
    await runSchedule(bot, friday);
    await runSchedule(bot, morning);
    await runSchedule(bot, friday);

    expect(deleteMessage).toHaveBeenCalledTimes(2);
    const deletedIds = deleteMessage.mock.calls.map((c) => c[1]).sort();
    expect(deletedIds).toEqual([1, 2]);
    expect(getLastMessageId('morning_reminder')).toBe(3);
    expect(getLastMessageId('friday_family')).toBe(4);
  });
});

describe('evening_poll is wired for replace-on-next-fire (keepLast=1)', () => {
  it('keeps exactly one live poll: the new one posts, then the old one is deleted', async () => {
    const sendPoll = vi
      .fn()
      .mockResolvedValueOnce({ message_id: 9001 })
      .mockResolvedValueOnce({ message_id: 9002 });
    const deleteMessage = vi.fn().mockResolvedValue(true);
    const bot = {
      api: { sendMessage: vi.fn(), sendPoll, deleteMessage },
    } as unknown as Bot<Context>;
    const def = findSchedule('evening_poll')!;
    expect(def.keepLast).toBe(1);

    await runSchedule(bot, def);
    await runSchedule(bot, def);

    expect(deleteMessage).toHaveBeenCalledTimes(1);
    expect(deleteMessage.mock.calls[0][1]).toBe(9001);
    expect(getMessageIds('evening_poll')).toEqual([9002]);
  });

  it('a poll WITHOUT keepLast is never tracked (historic default)', async () => {
    const { bot, sendPoll, deleteMessage } = fakeBot();
    const untrackedPoll: ScheduleDef = {
      name: 'untracked_poll',
      kind: 'poll',
      cron: '0 3 * * *',
      poll: { question: 'q', options: ['a', 'b'] },
    };
    await runSchedule(bot, untrackedPoll);
    await runSchedule(bot, untrackedPoll);

    expect(sendPoll).toHaveBeenCalledTimes(2);
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('untracked_poll')).toBeUndefined();
  });
});
