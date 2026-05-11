import { describe, it, expect } from 'vitest';
import {
  MATCH_STATUS,
  listMatchesQuerySchema,
  matchIdParamSchema,
  createMatchSchema,
  updateScoreSchema,
} from './matches.js';

describe('MATCH_STATUS', () => {
  it('has the correct status values', () => {
    expect(MATCH_STATUS.SCHEDULED).toBe('scheduled');
    expect(MATCH_STATUS.LIVE).toBe('live');
    expect(MATCH_STATUS.FINISHED).toBe('finished');
  });

  it('contains exactly three statuses', () => {
    expect(Object.keys(MATCH_STATUS)).toHaveLength(3);
  });
});

describe('listMatchesQuerySchema', () => {
  it('accepts a valid limit', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: '10' });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(10);
  });

  it('accepts limit as a number', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 25 });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(25);
  });

  it('accepts limit at the max boundary (100)', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 100 });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(100);
  });

  it('rejects limit exceeding 100', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects limit of 0', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative limit', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer limit', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 1.5 });
    expect(result.success).toBe(false);
  });

  it('accepts missing limit (optional)', () => {
    const result = listMatchesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.limit).toBeUndefined();
  });

  it('coerces string numeric limit', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: '50' });
    expect(result.success).toBe(true);
    expect(result.data.limit).toBe(50);
  });

  it('rejects non-numeric string limit', () => {
    const result = listMatchesQuerySchema.safeParse({ limit: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('matchIdParamSchema', () => {
  it('accepts a valid positive integer id', () => {
    const result = matchIdParamSchema.safeParse({ id: 1 });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(1);
  });

  it('coerces string id to integer', () => {
    const result = matchIdParamSchema.safeParse({ id: '42' });
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(42);
  });

  it('rejects id of 0', () => {
    const result = matchIdParamSchema.safeParse({ id: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative id', () => {
    const result = matchIdParamSchema.safeParse({ id: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer id', () => {
    const result = matchIdParamSchema.safeParse({ id: 1.5 });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = matchIdParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('createMatchSchema', () => {
  const validPayload = {
    sport: 'football',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    startTime: '2025-06-01T10:00:00Z',
    endTime: '2025-06-01T12:00:00Z',
  };

  it('accepts a valid payload with required fields only', () => {
    const result = createMatchSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    expect(result.data.sport).toBe('football');
    expect(result.data.homeTeam).toBe('Team A');
    expect(result.data.awayTeam).toBe('Team B');
  });

  it('accepts a valid payload with optional score fields', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: 2,
      awayScore: 1,
    });
    expect(result.success).toBe(true);
    expect(result.data.homeScore).toBe(2);
    expect(result.data.awayScore).toBe(1);
  });

  it('accepts score of 0', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: 0,
      awayScore: 0,
    });
    expect(result.success).toBe(true);
    expect(result.data.homeScore).toBe(0);
    expect(result.data.awayScore).toBe(0);
  });

  it('coerces string scores to numbers', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: '3',
      awayScore: '2',
    });
    expect(result.success).toBe(true);
    expect(result.data.homeScore).toBe(3);
    expect(result.data.awayScore).toBe(2);
  });

  it('rejects empty sport', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, sport: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty homeTeam', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, homeTeam: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty awayTeam', () => {
    const result = createMatchSchema.safeParse({ ...validPayload, awayTeam: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing sport', () => {
    const { sport, ...rest } = validPayload;
    const result = createMatchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing homeTeam', () => {
    const { homeTeam, ...rest } = validPayload;
    const result = createMatchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing startTime', () => {
    const { startTime, ...rest } = validPayload;
    const result = createMatchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing endTime', () => {
    const { endTime, ...rest } = validPayload;
    const result = createMatchSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO startTime', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: '2025-06-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-ISO endTime', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      endTime: 'not-a-date',
    });
    expect(result.success).toBe(false);
  });

  it('rejects endTime equal to startTime', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: '2025-06-01T10:00:00Z',
      endTime: '2025-06-01T10:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects endTime before startTime', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: '2025-06-01T12:00:00Z',
      endTime: '2025-06-01T10:00:00Z',
    });
    expect(result.success).toBe(false);
    const issues = result.error.issues;
    expect(issues.some(i => i.path.includes('endTime'))).toBe(true);
  });

  it('endTime error message is correct when endTime <= startTime', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      startTime: '2025-06-01T10:00:00Z',
      endTime: '2025-06-01T09:00:00Z',
    });
    expect(result.success).toBe(false);
    const endTimeIssue = result.error.issues.find(i => i.path.includes('endTime'));
    expect(endTimeIssue?.message).toBe('endTime must be chronologically after startTime');
  });

  it('rejects negative homeScore', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative awayScore', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      awayScore: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer homeScore', () => {
    const result = createMatchSchema.safeParse({
      ...validPayload,
      homeScore: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('updateScoreSchema', () => {
  it('accepts valid scores', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 2, awayScore: 1 });
    expect(result.success).toBe(true);
    expect(result.data.homeScore).toBe(2);
    expect(result.data.awayScore).toBe(1);
  });

  it('accepts scores of 0', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 0, awayScore: 0 });
    expect(result.success).toBe(true);
  });

  it('coerces string scores to numbers', () => {
    const result = updateScoreSchema.safeParse({ homeScore: '3', awayScore: '0' });
    expect(result.success).toBe(true);
    expect(result.data.homeScore).toBe(3);
    expect(result.data.awayScore).toBe(0);
  });

  it('rejects missing homeScore', () => {
    const result = updateScoreSchema.safeParse({ awayScore: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects missing awayScore', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 1 });
    expect(result.success).toBe(false);
  });

  it('rejects negative homeScore', () => {
    const result = updateScoreSchema.safeParse({ homeScore: -1, awayScore: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative awayScore', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 0, awayScore: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer scores', () => {
    const result = updateScoreSchema.safeParse({ homeScore: 1.5, awayScore: 0 });
    expect(result.success).toBe(false);
  });
});
