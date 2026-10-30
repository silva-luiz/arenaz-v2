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

  it('says what the clock is for, as the prototype does', () => {
    render(<Countdown expiresAt={inSeconds(125)} />);
    expect(screen.getByText('Seu horário está reservado por')).toBeVisible();
    expect(screen.getByText('02:05')).toHaveClass('font-mono');
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
    expect(onExpire).toHaveBeenCalledWith(true);
  });

  it('is already expired when the deadline has passed', () => {
    const onExpire = vi.fn();
    render(<Countdown expiresAt={inSeconds(-10)} onExpire={onExpire} />);
    expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Reported once, as "not live": nothing ran out while mounted.
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(onExpire).toHaveBeenCalledWith(false);
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

  describe('across refreshes of the page (new serverNow props)', () => {
    const serverNowIso = () => new Date(Date.now()).toISOString();

    function poll(
      view: ReturnType<typeof render>,
      expiresAt: string,
      onExpire?: (live: boolean) => void,
    ) {
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      view.rerender(
        <Countdown
          expiresAt={expiresAt}
          serverNow={serverNowIso()}
          onExpire={onExpire}
        />,
      );
    }

    it('keeps the same status node and speaks only when the minute changes', () => {
      const expiresAt = inSeconds(200);
      const view = render(
        <Countdown expiresAt={expiresAt} serverNow={serverNowIso()} />,
      );
      const status = screen.getByRole('status');
      const observer = new MutationObserver(() => undefined);
      observer.observe(status, {
        childList: true,
        characterData: true,
        subtree: true,
      });

      const spoken = [status.textContent];
      // Twenty polls, 100 seconds: 200 s -> 100 s left (4, 3 and 2 minutes).
      for (let step = 0; step < 20; step += 1) {
        poll(view, expiresAt);
        const now = screen.getByRole('status');
        expect(now).toBe(status);
        if (now.textContent !== spoken.at(-1)) spoken.push(now.textContent);
      }
      const touched = observer.takeRecords();
      observer.disconnect();

      expect(spoken).toEqual([
        'Faltam 4 minutos para pagar',
        'Faltam 3 minutos para pagar',
        'Faltam 2 minutos para pagar',
      ]);
      // The region was only touched when the spoken text changed.
      expect(touched).toHaveLength(2);
    });

    it('re-bases the clock on the new server time', () => {
      // The device runs a minute behind the server: 3 minutes are left by the
      // server's clock, 4 by the device's.
      const expiresAt = inSeconds(180);
      const view = render(
        <Countdown
          expiresAt={expiresAt}
          serverNow={new Date(NOW.getTime()).toISOString()}
        />,
      );
      expect(screen.getByText('03:00')).toBeVisible();
      // A refreshed page says the server is 30 s further than the device thinks.
      view.rerender(
        <Countdown
          expiresAt={expiresAt}
          serverNow={new Date(NOW.getTime() + 30_000).toISOString()}
        />,
      );
      expect(screen.getByText('02:30')).toBeVisible();
    });

    it('expiry sticks: still expired, same node, reported once, after more polls', () => {
      const onExpire = vi.fn();
      const expiresAt = inSeconds(8);
      const view = render(
        <Countdown
          expiresAt={expiresAt}
          serverNow={serverNowIso()}
          onExpire={onExpire}
        />,
      );
      const status = screen.getByRole('status');
      poll(view, expiresAt, onExpire);
      expect(onExpire).not.toHaveBeenCalled();
      poll(view, expiresAt, onExpire);
      expect(status).toHaveTextContent('O prazo para pagamento acabou');
      expect(onExpire).toHaveBeenCalledTimes(1);
      expect(onExpire).toHaveBeenCalledWith(true);

      for (let step = 0; step < 5; step += 1) poll(view, expiresAt, onExpire);
      expect(screen.getByRole('status')).toBe(status);
      expect(status).toHaveTextContent('O prazo para pagamento acabou');
      expect(screen.queryByText(/^\d{2}:\d{2}$/)).toBeNull();
      expect(onExpire).toHaveBeenCalledTimes(1);
    });

    it('goes back to counting when a refresh says there is time left, and reports the next expiry', () => {
      const onExpire = vi.fn();
      const expiresAt = inSeconds(5);
      // The device clock is ahead: it runs out early.
      const view = render(
        <Countdown
          expiresAt={expiresAt}
          serverNow={new Date(NOW.getTime() - 60_000).toISOString()}
          onExpire={onExpire}
        />,
      );
      expect(screen.getByText('01:05')).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(66_000);
      });
      expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
      expect(onExpire).toHaveBeenCalledTimes(1);

      // The refreshed page still says "held": 10 s left on the server's clock.
      view.rerender(
        <Countdown
          expiresAt={expiresAt}
          serverNow={new Date(NOW.getTime() - 5000).toISOString()}
          onExpire={onExpire}
        />,
      );
      expect(screen.getByText('00:10')).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(11_000);
      });
      expect(screen.getByText('O prazo para pagamento acabou')).toBeVisible();
      expect(onExpire).toHaveBeenCalledTimes(2);
    });
  });
});
