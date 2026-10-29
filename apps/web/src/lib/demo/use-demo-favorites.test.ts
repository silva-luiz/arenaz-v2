import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDemoFavorites, useDemoFavorites } from './use-demo-favorites';

beforeEach(() => {
  resetDemoFavorites();
});

describe('useDemoFavorites', () => {
  it('starts with nothing saved', () => {
    const { result } = renderHook(() => useDemoFavorites());
    expect(result.current.isFavorite('arena-vila-madalena')).toBe(false);
  });

  it('toggles a venue on and off', () => {
    const { result } = renderHook(() => useDemoFavorites());

    act(() => {
      result.current.toggle('arena-vila-madalena');
    });
    expect(result.current.isFavorite('arena-vila-madalena')).toBe(true);
    expect(result.current.isFavorite('padel-pinheiros')).toBe(false);

    act(() => {
      result.current.toggle('arena-vila-madalena');
    });
    expect(result.current.isFavorite('arena-vila-madalena')).toBe(false);
  });

  it('keeps every mounted hook in sync (memory only, nothing persisted)', () => {
    const first = renderHook(() => useDemoFavorites());
    const second = renderHook(() => useDemoFavorites());

    act(() => {
      first.result.current.toggle('saibro-butanta');
    });

    expect(second.result.current.isFavorite('saibro-butanta')).toBe(true);
    expect(window.localStorage.length).toBe(0);
  });
});
