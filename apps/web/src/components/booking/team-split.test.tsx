import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ demo: true }));

vi.mock('@/lib/demo', async () => {
  const fixtures = await import('@/lib/demo/fixtures');
  return {
    get isDemoMode() {
      return captured.demo;
    },
    get demoSquad() {
      return captured.demo ? fixtures.DEMO_SQUAD : [];
    },
  };
});

import { SplitOption, SquadRacha } from './team-split';

afterEach(() => {
  captured.demo = true;
});

describe('SplitOption', () => {
  it('is on by default and says what each player is charged', () => {
    render(<SplitOption totalCents={46200} players={14} />);
    const toggle = screen.getByRole('switch', {
      name: /Receber de volta do time/,
    });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveTextContent(
      /Você paga tudo e o app cobra R\$\s33,00 de cada um/,
    );
  });

  it('rounds each share up to the cent', () => {
    render(<SplitOption totalCents={15000} players={14} />);
    expect(screen.getByRole('switch')).toHaveTextContent(
      /R\$\s10,72 de cada um/,
    );
  });

  it('switches off to "paga o valor inteiro sozinho"', async () => {
    const user = userEvent.setup();
    render(<SplitOption totalCents={46200} players={14} />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.getByRole('switch')).toHaveTextContent(
      'Você paga o valor inteiro sozinho',
    );
  });

  it('is a 44px target', () => {
    render(<SplitOption totalCents={46200} players={14} />);
    expect(screen.getByRole('switch')).toHaveClass('min-h-11');
  });

  it('renders nothing outside the demo', () => {
    captured.demo = false;
    const { container } = render(
      <SplitOption totalCents={46200} players={14} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SquadRacha', () => {
  function renderRacha() {
    return render(
      <SquadRacha
        players={14}
        totalCents={46200}
        shareMessage="Bora jogar! Arena Vila, Qua, 28 out, 20:00–22:00"
      />,
    );
  }

  it('lists the six players and counts those who paid out of the group', () => {
    renderRacha();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Racha do time' }),
    ).toBeVisible();
    expect(screen.getByText('3 de 14 pagaram')).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText(/Cada um paga/)).toHaveTextContent(
      /Cada um paga R\$\s33,00\. O dinheiro cai direto na sua conta\./,
    );
    expect(
      screen.getByRole('progressbar', { name: 'Pagamentos do racha' }),
    ).toHaveAttribute('aria-valuenow', '3');
  });

  it('toggles a player between Pago and Pendente and recounts', async () => {
    const user = userEvent.setup();
    renderRacha();
    const bruno = screen.getByRole('button', { name: /Bruno M\.: pendente/ });
    expect(bruno).toHaveTextContent('Pendente');
    expect(bruno).toHaveClass('min-h-11');
    await user.click(bruno);
    expect(
      screen.getByRole('button', { name: /Bruno M\.: pago/ }),
    ).toHaveTextContent('Pago');
    expect(screen.getByText('4 de 14 pagaram')).toBeVisible();
  });

  it('has the group link, a 52px WhatsApp button', () => {
    renderRacha();
    const link = screen.getByRole('link', { name: /Mandar link no grupo/ });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(link.getAttribute('href') ?? '')).toContain(
      'Arena Vila',
    );
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders nothing outside the demo', () => {
    captured.demo = false;
    const { container } = renderRacha();
    expect(container).toBeEmptyDOMElement();
  });
});
