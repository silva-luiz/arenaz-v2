import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown } from './countdown';

const NOW = new Date('2026-11-02T12:00:00.000Z');
const inSeconds = (seconds: number) =>
  new Date(NOW.getTime() + seconds * 1000).toISOString();

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts down to the server deadline in mm:ss', () => {
    render(<Countdown expiresAt={inSeconds(125)} />);
    expect(screen.getByText('02:05')).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('02:00')).toBeVisible();
  });

  it('reaches zero, says the deadline is over and calls onExpire once', () => {
    const onExpire = vi.fn();
    render(<Countdown expiresAt={inSeconds(3)} onExpire={onExpire} />);
    expect(onExpire).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
    expect(screen.queryByText(/^\d{2}:\d{2}$/)).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('is already expired when the deadline has passed', () => {
    render(<Countdown expiresAt={inSeconds(-10)} />);
    expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
  });

  it('announces to screen readers only when the minute changes', () => {
    render(<Countdown expiresAt={inSeconds(125)} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Faltam 3 minutos para pagar');
    // The ticking digits are not read out.
    expect(
      screen.getByText('02:05').closest('[aria-hidden="true"]'),
    ).not.toBeNull();

    const seen: string[] = [status.textContent];
    const observer = new MutationObserver(() => {
      seen.push(status.textContent);
    });
    observer.observe(status, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    act(() => {
      vi.advanceTimersByTime(4000); // 02:01 left, same minute
    });
    expect(status).toHaveTextContent('Faltam 3 minutos para pagar');
    act(() => {
      vi.advanceTimersByTime(5000); // 01:56 left
    });
    expect(status).toHaveTextContent('Faltam 2 minutos para pagar');
    observer.disconnect();
  });

  it('uses the singular for the last minute', () => {
    render(<Countdown expiresAt={inSeconds(30)} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Falta 1 minuto para pagar',
    );
  });
});
