import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Bot, Context } from 'grammy';
import {
  _resetForTests as resetState,
  getLastMessageId,
  setLastMessageId,
  getMessageIds,
} from 'telegram-broadcast-kit';
import { runSchedule } from './scheduler';
import { findSchedule } from './schedules';
import type { ScheduleDef } from './types';

/**
 * runSchedule must dispatch on `kind` (message -> sendMessage, poll ->
 * sendPoll) and implement the ring buffer: a tracked schedule posts the
 * new copy, then deletes older ones beyond `keepLast`. A failed post
 * leaves state untouched; a failed delete still advances state. No network.
 *
 * The mechanics tests use SYNTHETIC schedule defs so they stay valid no
 * matter how the real content table in schedules.ts changes. A separate
 * block then guards the real schedules' keepLast wiring.
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

// A tracked message schedule (no keepLast => message default 1).
const trackedMsg: ScheduleDef = {
  name: 'tracked_msg',
  kind: 'message',
  cron: '0 3 * * *',
  content: 'hello',
};

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
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage: vi.fn() },
    } as unknown as Bot<Context>;
    await expect(runSchedule(bot, trackedMsg)).resolves.toBeNull();
  });
});

describe('runSchedule replace-on-next-fire (keepLast = 1 message)', () => {
  it('first fire posts and tracks the id but does NOT delete anything', async () => {
    const { bot, sendMessage, deleteMessage } = fakeBot();
    const id = await runSchedule(bot, trackedMsg);
    expect(id).toBe(11);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('tracked_msg')).toBe(11);
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

    await runSchedule(bot, trackedMsg);
    await runSchedule(bot, trackedMsg);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(deleteMessage).toHaveBeenCalledTimes(1);
    expect(deleteMessage.mock.calls[0][1]).toBe(101);
    expect(getLastMessageId('tracked_msg')).toBe(102);

    // Post must happen before delete, never the other way around.
    const order =
      sendMessage.mock.invocationCallOrder[1] < deleteMessage.mock.invocationCallOrder[0];
    expect(order).toBe(true);
  });

  it('a failed post leaves the previous pointer intact for next time', async () => {
    await setLastMessageId('tracked_msg', 555);
    const sendMessage = vi.fn().mockRejectedValue(new Error('429'));
    const deleteMessage = vi.fn();
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;

    await expect(runSchedule(bot, trackedMsg)).resolves.toBeNull();

    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('tracked_msg')).toBe(555);
  });

  it('a failed delete still advances the pointer (best-effort cleanup)', async () => {
    await setLastMessageId('tracked_msg', 700);
    const sendMessage = vi.fn().mockResolvedValue({ message_id: 701 });
    const deleteMessage = vi.fn().mockRejectedValue(new Error('400 message to delete not found'));
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;

    const id = await runSchedule(bot, trackedMsg);

    expect(id).toBe(701);
    expect(deleteMessage).toHaveBeenCalledWith('@test_channel', 700);
    expect(getLastMessageId('tracked_msg')).toBe(701);
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
    const a: ScheduleDef = { name: 'a', kind: 'message', cron: '0 3 * * *', content: 'x' };
    const b: ScheduleDef = { name: 'b', kind: 'message', cron: '0 3 * * *', content: 'y' };
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce({ message_id: 1 }) // a
      .mockResolvedValueOnce({ message_id: 2 }) // b
      .mockResolvedValueOnce({ message_id: 3 }) // a again
      .mockResolvedValueOnce({ message_id: 4 }); // b again
    const deleteMessage = vi.fn().mockResolvedValue(true);
    const bot = {
      api: { sendMessage, sendPoll: vi.fn(), deleteMessage },
    } as unknown as Bot<Context>;

    await runSchedule(bot, a);
    await runSchedule(bot, b);
    await runSchedule(bot, a);
    await runSchedule(bot, b);

    expect(deleteMessage).toHaveBeenCalledTimes(2);
    const deletedIds = deleteMessage.mock.calls.map((c) => c[1]).sort();
    expect(deletedIds).toEqual([1, 2]);
    expect(getLastMessageId('a')).toBe(3);
    expect(getLastMessageId('b')).toBe(4);
  });
});

describe('runSchedule keepLast = 0 (keep everything, never delete)', () => {
  it('a keepLast:0 message posts every time and is never tracked or deleted', async () => {
    const { bot, sendMessage, deleteMessage } = fakeBot();
    const keepAll: ScheduleDef = {
      name: 'keep_all',
      kind: 'message',
      cron: '0 3 * * *',
      content: 'x',
      keepLast: 0,
    };
    await runSchedule(bot, keepAll);
    await runSchedule(bot, keepAll);
    await runSchedule(bot, keepAll);

    expect(sendMessage).toHaveBeenCalledTimes(3);
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('keep_all')).toBeUndefined();
  });
});

describe('real schedule table is wired as intended', () => {
  it('morning_reminder keeps every tip (keepLast 0): no tracking, no delete', async () => {
    const { bot, sendMessage, deleteMessage } = fakeBot();
    const def = findSchedule('morning_reminder')!;
    expect(def.keepLast).toBe(0);

    await runSchedule(bot, def);
    await runSchedule(bot, def);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(deleteMessage).not.toHaveBeenCalled();
    expect(getLastMessageId('morning_reminder')).toBeUndefined();
  });

  it('evening_poll replaces itself daily (keepLast 1)', async () => {
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
});
