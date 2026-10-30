import { describe, expect, it } from 'vitest';
import { PLAYERS_RANGE } from './players.js';

describe('PLAYERS_RANGE', () => {
  it('is 2 to 30 players, 14 by default (inside the range)', () => {
    expect(PLAYERS_RANGE).toEqual({ min: 2, max: 30, default: 14 });
    expect(PLAYERS_RANGE.default).toBeGreaterThanOrEqual(PLAYERS_RANGE.min);
    expect(PLAYERS_RANGE.default).toBeLessThanOrEqual(PLAYERS_RANGE.max);
  });
});
