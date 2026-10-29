import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GlobalError from './global-error';

const SECRET = new Error('Invalid DATABASE_URL postgres://arenaz:senha@host');

// global-error renders its own <html>, so it is mounted on the document.
let root: Root | undefined;

function mount(reset: () => void) {
  root = createRoot(document);
  act(() => {
    root?.render(<GlobalError error={SECRET} reset={reset} />);
  });
}

describe('global error page', () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = undefined;
  });

  it('is a pt-BR document with a message that hides the error text', () => {
    mount(vi.fn());

    expect(document.documentElement).toHaveAttribute('lang', 'pt-BR');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Algo deu errado' }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent('DATABASE_URL');
    expect(document.body).not.toHaveTextContent('senha');
  });

  it('retries through reset()', async () => {
    const reset = vi.fn();
    mount(reset);

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
