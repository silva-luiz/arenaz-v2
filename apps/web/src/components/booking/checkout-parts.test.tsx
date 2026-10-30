import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AddressCard,
  BookingFacts,
  CancelNote,
  CheckoutHeader,
  ConfirmedHero,
  PriceCard,
  ReviewCard,
} from './checkout-parts';

const PHOTO = { url: '/foto.jpg', srcSet: '/foto-480.jpg 480w' };

describe('CheckoutHeader', () => {
  it('has a 44px back link and the page title as the h1', () => {
    render(
      <CheckoutHeader backHref="/espacos/arena" title="Confirmar e pagar" />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Confirmar e pagar' }),
    ).toBeVisible();
    const back = screen.getByRole('link', { name: 'Voltar' });
    expect(back).toHaveAttribute('href', '/espacos/arena');
    expect(back).toHaveClass('size-11');
  });
});

describe('ReviewCard', () => {
  it('shows the venue, the day, the time in mono and the court with the players', () => {
    render(
      <ReviewCard
        venueName="Arena Vila"
        photo={PHOTO}
        when="Qua, 28 out"
        range="20:00–22:00"
        detail="Society 1 · 14 jogadores"
      />,
    );
    expect(screen.getByText('Arena Vila')).toBeVisible();
    expect(screen.getByText(/Qua, 28 out/)).toBeVisible();
    expect(screen.getByText('20:00–22:00')).toHaveClass('font-mono');
    expect(screen.getByText('Society 1 · 14 jogadores')).toBeVisible();
    expect(document.querySelector('img')).toHaveAttribute('src', '/foto.jpg');
  });

  it('leaves the photo out when the venue has none (no empty box)', () => {
    const { container } = render(
      <ReviewCard
        venueName="Arena Vila"
        photo={null}
        when="Qua, 28 out"
        range="20:00–22:00"
        detail="Society 1"
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Arena Vila')).toBeVisible();
  });
});

describe('PriceCard', () => {
  it('lists the real hours and the Total, with no service fee', () => {
    render(
      <PriceCard durationLabel="2 horas" peak={false} totalCents={44000} />,
    );
    expect(screen.getByText('2 horas')).toBeVisible();
    expect(screen.getByText('Total')).toBeVisible();
    expect(screen.getAllByText(/R\$\s440,00/)).toHaveLength(2);
    expect(screen.queryByText(/Taxa de serviço/)).toBeNull();
  });

  it('marks a peak time ("horário nobre")', () => {
    render(<PriceCard durationLabel="2 horas" peak totalCents={44000} />);
    expect(screen.getByText('2 horas · horário nobre')).toBeVisible();
  });
});

describe('CancelNote', () => {
  it('promises free cancellation until the deadline, with its date and time', () => {
    render(
      <CancelNote
        deadline={{ label: 'ter, 27 out, 20:00', open: true }}
        paid={false}
      />,
    );
    expect(
      screen.getByText(
        'Cancelamento grátis até 24h antes (ter, 27 out, 20:00).',
      ),
    ).toBeVisible();
  });

  it('warns that a booking inside 24 hours cannot be cancelled after paying', () => {
    render(
      <CancelNote
        deadline={{ label: 'ter, 27 out, 20:00', open: false }}
        paid={false}
      />,
    );
    expect(screen.getByText(/começa em menos de 24h/)).toBeVisible();
    expect(screen.queryByText(/grátis/)).toBeNull();
  });

  it('tells a paid booking inside 24 hours it can no longer be cancelled', () => {
    render(
      <CancelNote
        deadline={{ label: 'ter, 27 out, 20:00', open: false }}
        paid
      />,
    );
    expect(screen.getByText(/não pode mais ser cancelada/)).toBeVisible();
  });
});

describe('ConfirmedHero', () => {
  it('says "Quadra garantida." over the photo with the venue, day and time', () => {
    render(
      <ConfirmedHero
        venueName="Arena Vila"
        photo={PHOTO}
        when="Qua, 28 out"
        range="20:00–22:00"
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Quadra garantida.' }),
    ).toBeVisible();
    expect(screen.getByText(/Arena Vila · Qua, 28 out ·/)).toBeVisible();
    expect(screen.getByText('20:00–22:00')).toHaveClass('font-mono');
    expect(document.querySelector('img')).toHaveAttribute('src', '/foto.jpg');
  });

  it('works without a photo (night green background)', () => {
    const { container } = render(
      <ConfirmedHero
        venueName="Arena Vila"
        photo={null}
        when="Qua, 28 out"
        range="20:00–22:00"
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Quadra garantida.' }),
    ).toBeVisible();
  });
});

describe('BookingFacts', () => {
  it('names the court and the total paid', () => {
    render(<BookingFacts fieldName="Society 1" totalCents={44000} />);
    const facts = screen.getByRole('list', { name: 'Sua reserva' });
    expect(within(facts).getByText('Society 1')).toBeVisible();
    expect(within(facts).getByText(/R\$\s440,00/)).toBeVisible();
  });
});

describe('AddressCard', () => {
  const address = {
    street: 'Rua Harmonia',
    number: '123',
    complement: 'Fundos',
    cep: '05435000',
    phone: '+5511987654321',
  };

  it('shows the street, the neighborhood, the CEP and a phone link', () => {
    render(
      <AddressCard
        address={address}
        neighborhood="Vila Madalena"
        city="São Paulo"
      />,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'Como chegar' }),
    ).toBeVisible();
    expect(screen.getByText(/Rua Harmonia, 123 - Fundos/)).toBeVisible();
    expect(screen.getByText(/05435-000/)).toBeVisible();
    expect(
      screen.getByRole('link', { name: '(11) 98765-4321' }),
    ).toHaveAttribute('href', 'tel:+5511987654321');
  });
});
