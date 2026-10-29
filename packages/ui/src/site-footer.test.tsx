import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteFooter } from './site-footer';

afterEach(() => {
  vi.useRealTimers();
});

describe('SiteFooter', () => {
  it('shows the current year and plain-text legal items', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2031-05-10T12:00:00Z'));
    render(<SiteFooter />);

    expect(screen.getByRole('contentinfo')).toHaveTextContent('© 2031 ArenaZ');
    expect(screen.getByText('Termos')).toBeVisible();
    expect(screen.getByText('Privacidade (LGPD)')).toBeVisible();
    expect(screen.getByText('Ajuda')).toBeVisible();
  });

  it('has no links yet (the pages do not exist)', () => {
    render(<SiteFooter />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
