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

  it('announces only once per minute and at the end', () => {
    render(<Countdown expiresAt={inSeconds(125)} />);
    expect(
      screen.getByText('02:05').closest('[aria-hidden="true"]'),
    ).not.toBeNull();

    const spoken = [screen.getByRole('status').textContent];
    for (let second = 0; second < 130; second += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      const text = screen.getByRole('status').textContent;
      if (text !== spoken.at(-1)) spoken.push(text);
    }
    expect(spoken).toEqual([
      'Faltam 3 minutos para pagar',
      'Faltam 2 minutos para pagar',
      'Falta 1 minuto para pagar',
      'O prazo para pagamento acabou',
    ]);
  });

  it('follows the server clock when it differs from the device clock', () => {
    // The device says 12:00:00, the server 11:59:00: 3 minutes are left.
    render(
      <Countdown
        expiresAt={inSeconds(120)}
        serverNow={new Date(NOW.getTime() - 60_000).toISOString()}
      />,
    );
    expect(screen.getByText('03:00')).toBeVisible();
  });

  it('uses the singular for the last minute', () => {
    render(<Countdown expiresAt={inSeconds(30)} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Falta 1 minuto para pagar',
    );
  });
});
