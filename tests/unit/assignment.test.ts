import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickWeightedVariant } from '../../src/server/experiments/assignment';

describe('weighted variant picker', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when total weight is not positive', () => {
    expect(pickWeightedVariant([])).toBeNull();
    expect(pickWeightedVariant([{ variantId: 'a', weight: 0 }, { variantId: 'b', weight: -1 }])).toBeNull();
  });

  it('selects the expected bucket based on Math.random', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.49).mockReturnValueOnce(0.99);
    const weights = [{ variantId: 'a', weight: 50 }, { variantId: 'b', weight: 50 }];
    expect(pickWeightedVariant(weights)).toBe('a');
    expect(pickWeightedVariant(weights)).toBe('a');
    expect(pickWeightedVariant(weights)).toBe('b');
  });

  it('returns the last matching bucket at the upper edge', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(pickWeightedVariant([{ variantId: 'a', weight: 1 }, { variantId: 'b', weight: 1 }])).toBe('b');
  });

  it('falls back to the last row if random output is outside the expected range', () => {
    vi.spyOn(Math, 'random').mockReturnValue(Number.POSITIVE_INFINITY);
    expect(pickWeightedVariant([{ variantId: 'a', weight: 1 }, { variantId: 'b', weight: 1 }])).toBe('b');
  });
});
