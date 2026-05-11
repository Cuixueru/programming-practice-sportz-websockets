import { describe, it, expect, vi, beforeEach } from 'vitest';
import httpMocks from 'node-mocks-http';
import { EventEmitter } from 'events';

// Mock the db module before importing the router
vi.mock('../db/db.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// Import after mock is set up
import { db } from '../db/db.js';
import { matchesRouter } from './matches.js';

/**
 * Dispatch a mock request to the router and wait for the response to be sent.
 */
function dispatch(method, path, { body = undefined, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpMocks.createRequest({ method, url: path, path, query, body });
    const res = httpMocks.createResponse({ eventEmitter: EventEmitter });

    res.on('end', () => resolve(res));

    matchesRouter.handle(req, res, (err) => {
      if (err) reject(err);
      else {
        // Route not matched - resolve anyway for completeness
        resolve(res);
      }
    });
  });
}

const validPostBody = {
  sport: 'football',
  homeTeam: 'Team A',
  awayTeam: 'Team B',
  startTime: '2025-06-01T10:00:00Z',
  endTime: '2025-06-01T12:00:00Z',
};

describe('GET /matches', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 200 with match data on success', async () => {
    const mockMatches = [
      { id: 1, sport: 'football', homeTeam: 'A', awayTeam: 'B', status: 'finished' },
    ];
    const limitMock = vi.fn().mockResolvedValue(mockMatches);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    db.select.mockReturnValue({ from: fromMock });

    const res = await dispatch('GET', '/');

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ data: mockMatches });
  });

  it('uses default limit of 50 when no limit is provided', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    db.select.mockReturnValue({ from: fromMock });

    await dispatch('GET', '/');

    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it('uses specified limit when provided', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    db.select.mockReturnValue({ from: fromMock });

    await dispatch('GET', '/', { query: { limit: '10' } });

    expect(limitMock).toHaveBeenCalledWith(10);
  });

  it('caps limit at 100 (boundary value)', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    db.select.mockReturnValue({ from: fromMock });

    await dispatch('GET', '/', { query: { limit: '100' } });

    expect(limitMock).toHaveBeenCalledWith(100);
  });

  it('returns 400 for non-numeric limit query parameter', async () => {
    const res = await dispatch('GET', '/', { query: { limit: 'abc' } });

    expect(res.statusCode).toBe(400);
    const body = res._getJSONData();
    expect(body).toHaveProperty('error', 'Invalid query parameters.');
    expect(body).toHaveProperty('details');
  });

  it('returns 400 when limit exceeds 100', async () => {
    const res = await dispatch('GET', '/', { query: { limit: '200' } });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toHaveProperty('error', 'Invalid query parameters.');
  });

  it('returns 400 when limit is 0', async () => {
    const res = await dispatch('GET', '/', { query: { limit: '0' } });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when limit is negative', async () => {
    const res = await dispatch('GET', '/', { query: { limit: '-5' } });

    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when database query fails', async () => {
    const limitMock = vi.fn().mockRejectedValue(new Error('DB connection failed'));
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    db.select.mockReturnValue({ from: fromMock });

    const res = await dispatch('GET', '/');

    expect(res.statusCode).toBe(500);
    expect(res._getJSONData()).toHaveProperty('error', 'Failed to list matches.');
  });

  it('returns empty array when no matches exist', async () => {
    const limitMock = vi.fn().mockResolvedValue([]);
    const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
    db.select.mockReturnValue({ from: fromMock });

    const res = await dispatch('GET', '/');

    expect(res.statusCode).toBe(200);
    expect(res._getJSONData()).toEqual({ data: [] });
  });
});

describe('POST /matches', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 201 with created match on valid payload', async () => {
    const createdMatch = {
      id: 1,
      ...validPostBody,
      homeScore: 0,
      awayScore: 0,
      status: 'scheduled',
    };
    const returningMock = vi.fn().mockResolvedValue([createdMatch]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    db.insert.mockReturnValue({ values: valuesMock });

    const res = await dispatch('POST', '/', { body: validPostBody });

    expect(res.statusCode).toBe(201);
    const body = res._getJSONData();
    expect(body).toHaveProperty('data');
    expect(body.data).toMatchObject({ id: 1 });
  });

  it('defaults homeScore and awayScore to 0 when not provided', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    db.insert.mockReturnValue({ values: valuesMock });

    await dispatch('POST', '/', { body: validPostBody });

    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.homeScore).toBe(0);
    expect(insertedValues.awayScore).toBe(0);
  });

  it('uses provided homeScore and awayScore', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    db.insert.mockReturnValue({ values: valuesMock });

    await dispatch('POST', '/', { body: { ...validPostBody, homeScore: 3, awayScore: 1 } });

    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.homeScore).toBe(3);
    expect(insertedValues.awayScore).toBe(1);
  });

  it('converts startTime and endTime to Date objects', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    db.insert.mockReturnValue({ values: valuesMock });

    await dispatch('POST', '/', { body: validPostBody });

    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.startTime).toBeInstanceOf(Date);
    expect(insertedValues.endTime).toBeInstanceOf(Date);
    expect(insertedValues.startTime.toISOString()).toBe('2025-06-01T10:00:00.000Z');
    expect(insertedValues.endTime.toISOString()).toBe('2025-06-01T12:00:00.000Z');
  });

  it('sets status to scheduled for a future match', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    db.insert.mockReturnValue({ values: valuesMock });

    await dispatch('POST', '/', {
      body: {
        ...validPostBody,
        startTime: '2099-06-01T10:00:00Z',
        endTime: '2099-06-01T12:00:00Z',
      },
    });

    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.status).toBe('scheduled');
  });

  it('sets status to finished for a past match', async () => {
    const returningMock = vi.fn().mockResolvedValue([{ id: 1 }]);
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    db.insert.mockReturnValue({ values: valuesMock });

    await dispatch('POST', '/', {
      body: {
        ...validPostBody,
        startTime: '2000-01-01T10:00:00Z',
        endTime: '2000-01-01T12:00:00Z',
      },
    });

    const insertedValues = valuesMock.mock.calls[0][0];
    expect(insertedValues.status).toBe('finished');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await dispatch('POST', '/', { body: { sport: 'football' } });

    expect(res.statusCode).toBe(400);
    const body = res._getJSONData();
    expect(body).toHaveProperty('error', 'Invalid payload.');
    expect(body).toHaveProperty('details');
  });

  it('returns 400 when endTime is before startTime', async () => {
    const res = await dispatch('POST', '/', {
      body: {
        ...validPostBody,
        startTime: '2025-06-01T12:00:00Z',
        endTime: '2025-06-01T10:00:00Z',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toHaveProperty('error', 'Invalid payload.');
  });

  it('returns 400 when endTime equals startTime', async () => {
    const res = await dispatch('POST', '/', {
      body: {
        ...validPostBody,
        startTime: '2025-06-01T10:00:00Z',
        endTime: '2025-06-01T10:00:00Z',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when sport is empty string', async () => {
    const res = await dispatch('POST', '/', { body: { ...validPostBody, sport: '' } });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when startTime is not ISO format', async () => {
    const res = await dispatch('POST', '/', { body: { ...validPostBody, startTime: '2025-06-01' } });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when homeScore is negative', async () => {
    const res = await dispatch('POST', '/', { body: { ...validPostBody, homeScore: -1 } });

    expect(res.statusCode).toBe(400);
  });

  it('returns 500 when database insert fails', async () => {
    const returningMock = vi.fn().mockRejectedValue(new Error('DB insert failed'));
    const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
    db.insert.mockReturnValue({ values: valuesMock });

    const res = await dispatch('POST', '/', { body: validPostBody });

    expect(res.statusCode).toBe(500);
    const body = res._getJSONData();
    expect(body).toHaveProperty('error', 'Failed to create match.');
    expect(body).toHaveProperty('details');
  });

  it('returns 400 when request body is empty', async () => {
    const res = await dispatch('POST', '/', { body: {} });

    expect(res.statusCode).toBe(400);
    expect(res._getJSONData()).toHaveProperty('error', 'Invalid payload.');
  });
});