import { describe, it, expect, vi } from 'vitest';
import { getMatchStatus, syncMatchStatus } from './match-status.js';
import { MATCH_STATUS } from '../validation/matches.js';

describe('getMatchStatus', () => {
  const past = '2020-01-01T10:00:00Z';
  const future = '2099-01-01T10:00:00Z';

  it('returns SCHEDULED when now is before startTime', () => {
    const startTime = '2099-06-01T10:00:00Z';
    const endTime = '2099-06-01T12:00:00Z';
    const now = new Date('2025-01-01T00:00:00Z');
    expect(getMatchStatus(startTime, endTime, now)).toBe(MATCH_STATUS.SCHEDULED);
  });

  it('returns LIVE when now is between startTime and endTime', () => {
    const startTime = '2025-06-01T10:00:00Z';
    const endTime = '2025-06-01T12:00:00Z';
    const now = new Date('2025-06-01T11:00:00Z');
    expect(getMatchStatus(startTime, endTime, now)).toBe(MATCH_STATUS.LIVE);
  });

  it('returns FINISHED when now equals endTime', () => {
    const startTime = '2025-06-01T10:00:00Z';
    const endTime = '2025-06-01T12:00:00Z';
    const now = new Date('2025-06-01T12:00:00Z');
    expect(getMatchStatus(startTime, endTime, now)).toBe(MATCH_STATUS.FINISHED);
  });

  it('returns FINISHED when now is after endTime', () => {
    const startTime = '2020-06-01T10:00:00Z';
    const endTime = '2020-06-01T12:00:00Z';
    const now = new Date('2025-01-01T00:00:00Z');
    expect(getMatchStatus(startTime, endTime, now)).toBe(MATCH_STATUS.FINISHED);
  });

  it('returns LIVE when now equals startTime (boundary)', () => {
    const startTime = '2025-06-01T10:00:00Z';
    const endTime = '2025-06-01T12:00:00Z';
    const now = new Date(startTime);
    expect(getMatchStatus(startTime, endTime, now)).toBe(MATCH_STATUS.LIVE);
  });

  it('returns null when startTime is invalid', () => {
    expect(getMatchStatus('not-a-date', '2025-06-01T12:00:00Z')).toBeNull();
  });

  it('returns null when endTime is invalid', () => {
    expect(getMatchStatus('2025-06-01T10:00:00Z', 'not-a-date')).toBeNull();
  });

  it('returns null when both times are invalid', () => {
    expect(getMatchStatus('invalid', 'invalid')).toBeNull();
  });

  it('returns null for empty string startTime', () => {
    expect(getMatchStatus('', '2025-06-01T12:00:00Z')).toBeNull();
  });

  it('returns null for empty string endTime', () => {
    expect(getMatchStatus('2025-06-01T10:00:00Z', '')).toBeNull();
  });

  it('uses current time by default (no now parameter)', () => {
    // A match that started long ago and ends long in the future should be LIVE by default
    const startTime = '2000-01-01T00:00:00Z';
    const endTime = '2099-12-31T23:59:59Z';
    const result = getMatchStatus(startTime, endTime);
    expect(result).toBe(MATCH_STATUS.LIVE);
  });

  it('accepts Date objects for startTime and endTime', () => {
    const startTime = new Date('2025-06-01T10:00:00Z');
    const endTime = new Date('2025-06-01T12:00:00Z');
    const now = new Date('2025-06-01T11:00:00Z');
    expect(getMatchStatus(startTime, endTime, now)).toBe(MATCH_STATUS.LIVE);
  });

  it('returns SCHEDULED one millisecond before startTime', () => {
    const startTime = '2025-06-01T10:00:00.000Z';
    const endTime = '2025-06-01T12:00:00.000Z';
    const now = new Date(new Date(startTime).getTime() - 1);
    expect(getMatchStatus(startTime, endTime, now)).toBe(MATCH_STATUS.SCHEDULED);
  });
});

describe('syncMatchStatus', () => {
  it('calls updateStatus when match status differs from computed status', async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const match = {
      startTime: '2000-01-01T00:00:00Z',
      endTime: '2000-01-01T02:00:00Z',
      status: MATCH_STATUS.SCHEDULED,
    };

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).toHaveBeenCalledWith(MATCH_STATUS.FINISHED);
    expect(result).toBe(MATCH_STATUS.FINISHED);
    expect(match.status).toBe(MATCH_STATUS.FINISHED);
  });

  it('does not call updateStatus when status is already correct', async () => {
    const updateStatus = vi.fn();
    const match = {
      startTime: '2000-01-01T00:00:00Z',
      endTime: '2000-01-01T02:00:00Z',
      status: MATCH_STATUS.FINISHED,
    };

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(MATCH_STATUS.FINISHED);
  });

  it('returns existing status when getMatchStatus returns null (invalid times)', async () => {
    const updateStatus = vi.fn();
    const match = {
      startTime: 'invalid',
      endTime: 'invalid',
      status: MATCH_STATUS.SCHEDULED,
    };

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).not.toHaveBeenCalled();
    expect(result).toBe(MATCH_STATUS.SCHEDULED);
  });

  it('mutates match.status when status changes', async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const match = {
      startTime: '2099-06-01T10:00:00Z',
      endTime: '2099-06-01T12:00:00Z',
      status: MATCH_STATUS.FINISHED,
    };

    await syncMatchStatus(match, updateStatus);

    expect(match.status).toBe(MATCH_STATUS.SCHEDULED);
  });

  it('awaits the updateStatus callback', async () => {
    let resolved = false;
    const updateStatus = vi.fn().mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 0));
      resolved = true;
    });
    const match = {
      startTime: '2099-06-01T10:00:00Z',
      endTime: '2099-06-01T12:00:00Z',
      status: MATCH_STATUS.LIVE,
    };

    await syncMatchStatus(match, updateStatus);
    expect(resolved).toBe(true);
  });

  it('transitions SCHEDULED to LIVE when match is ongoing', async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const match = {
      startTime: '2000-01-01T00:00:00Z',
      endTime: '2099-12-31T23:59:59Z',
      status: MATCH_STATUS.SCHEDULED,
    };

    const result = await syncMatchStatus(match, updateStatus);

    expect(updateStatus).toHaveBeenCalledWith(MATCH_STATUS.LIVE);
    expect(result).toBe(MATCH_STATUS.LIVE);
  });
});