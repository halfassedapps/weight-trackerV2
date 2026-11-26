import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeGetJSON, safeRemoveItem, safeSetItem, safeSetJSON } from '../../../src/lib/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('safeSetItem / safeGetJSON / safeSetJSON / safeRemoveItem', () => {
  it('round-trips a JSON value', () => {
    safeSetJSON('k', { a: 1, b: [1, 2, 3] });
    expect(safeGetJSON('k')).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('returns null for a missing key', () => {
    expect(safeGetJSON('missing')).toBeNull();
  });

  it('returns null for malformed JSON instead of throwing', () => {
    localStorage.setItem('bad', '{not json');
    expect(safeGetJSON('bad')).toBeNull();
  });

  it('removes a key', () => {
    safeSetItem('k', 'v');
    safeRemoveItem('k');
    expect(localStorage.getItem('k')).toBeNull();
  });

  describe('when localStorage throws (private browsing / quota)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('safeSetItem swallows the exception instead of propagating it', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => safeSetItem('k', 'v')).not.toThrow();
    });

    it('safeGetJSON returns null instead of propagating the exception', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(safeGetJSON('k')).toBeNull();
    });

    it('safeRemoveItem swallows the exception instead of propagating it', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => safeRemoveItem('k')).not.toThrow();
    });
  });
});
