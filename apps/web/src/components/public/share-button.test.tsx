import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareButton } from './share-button';

const PAGE_URL = `${window.location.origin}${window.location.pathname}`;

function stubNavigator(values: {
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
}) {
  Object.defineProperty(navigator, 'share', {
    value: values.share,
    configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: values.writeText ? { writeText: values.writeText } : undefined,
    configurable: true,
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('ShareButton', () => {
  it('uses the share sheet when the browser has one', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    // user-event installs its own clipboard on setup; stub after it.
    const user = userEvent.setup();
    stubNavigator({ share, writeText });
    render(<ShareButton title="Arena Vila Madalena" />);

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    expect(share).toHaveBeenCalledWith({
      title: 'Arena Vila Madalena',
      url: PAGE_URL,
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByText('Link copiado')).not.toBeInTheDocument();
  });

  it('does not treat a dismissed share sheet as a failure', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(() =>
      Promise.reject(new DOMException('cancelled', 'AbortError')),
    );
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    // user-event installs its own clipboard on setup; stub after it.
    const user = userEvent.setup();
    stubNavigator({ share, writeText });
    render(<ShareButton title="Arena" />);

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('copies the link and announces it when there is no share sheet', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const user = userEvent.setup();
    stubNavigator({ writeText });
    render(<ShareButton title="Arena" />);

    const status = screen.getByRole('status');
    expect(status).toBeEmptyDOMElement();

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    expect(writeText).toHaveBeenCalledWith(PAGE_URL);
    await waitFor(() => {
      expect(status).toHaveTextContent('Link copiado');
    });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('shows the link to copy by hand when neither is available', async () => {
    const user = userEvent.setup();
    stubNavigator({});
    render(<ShareButton title="Arena" />);

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    const input = screen.getByRole('textbox', { name: 'Link do espaço' });
    expect(input).toHaveValue(PAGE_URL);
    expect(input).toHaveAttribute('readonly');
    expect(screen.queryByText('Link copiado')).not.toBeInTheDocument();
  });

  it('falls back to the manual link when copying is refused', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.reject(new Error('denied')),
    );
    const user = userEvent.setup();
    stubNavigator({ writeText });
    render(<ShareButton title="Arena" />);

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    expect(
      await screen.findByRole('textbox', { name: 'Link do espaço' }),
    ).toHaveValue(PAGE_URL);
  });

  it('copies the link when the share sheet fails for a reason other than a dismissal', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(() =>
      Promise.reject(new DOMException('blocked', 'NotAllowedError')),
    );
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve(),
    );
    const user = userEvent.setup();
    stubNavigator({ share, writeText });
    render(<ShareButton title="Arena" />);

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(PAGE_URL);
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Link copiado');
    });
  });

  it('clears "Link copiado" after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const writeText = vi.fn<(text: string) => Promise<void>>(() =>
        Promise.resolve(),
      );
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      stubNavigator({ writeText });
      render(<ShareButton title="Arena" />);

      await user.click(screen.getByRole('button', { name: 'Compartilhar' }));
      await waitFor(() => {
        expect(screen.getByRole('status')).toHaveTextContent('Link copiado');
      });

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.getByRole('status')).toBeEmptyDOMElement();
    } finally {
      vi.useRealTimers();
    }
  });

  it('focuses the manual link, announces it and closes with "Fechar"', async () => {
    const user = userEvent.setup();
    stubNavigator({});
    render(<ShareButton title="Arena" />);

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));

    const input = screen.getByRole('textbox', { name: 'Link do espaço' });
    expect(input).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Copie o link no campo que apareceu.',
    );

    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toHaveFocus();
  });

  it('closes the manual link with Esc and gives the focus back', async () => {
    const user = userEvent.setup();
    stubNavigator({});
    render(<ShareButton title="Arena" />);

    await user.click(screen.getByRole('button', { name: 'Compartilhar' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toHaveFocus();
  });
});
