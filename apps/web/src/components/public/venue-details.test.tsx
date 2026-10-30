import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const captured = vi.hoisted(() => ({ demo: false }));

vi.mock('@/lib/demo', async () => {
  const fixtures = await import('@/lib/demo/fixtures');
  return {
    get isDemoMode() {
      return captured.demo;
    },
    demoVenueExtras: (slug: string) =>
      captured.demo ? (fixtures.DEMO_VENUE_EXTRAS[slug] ?? null) : null,
  };
});

// Leaflet needs a real browser; the map has its own tests.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub(props: { lat: number; lng: number }) {
      return (
        <div data-testid="map-stub" data-lat={props.lat} data-lng={props.lng} />
      );
    },
}));

import { VenueDetails, VenueOverview, VenueReviews } from './venue-details';
import { makeField, makeVenue } from '@/test/venue-fixture';

function section(name: string) {
  return screen.getByRole('region', { name });
}

describe('VenueDetails', () => {
  it('shows the description, keeping the line breaks', () => {
    render(<VenueDetails venue={makeVenue()} />);

    const text = within(section('Sobre o espaço')).getByText(
      /Society coberto com vestiário/,
    );
    expect(text).toHaveTextContent('Estacionamento no local.');
    expect(text.className).toContain('whitespace-pre-line');
  });

  it('skips the description section when there is none', () => {
    render(<VenueDetails venue={makeVenue({ description: null })} />);

    expect(
      screen.queryByRole('heading', { name: 'Sobre o espaço' }),
    ).not.toBeInTheDocument();
  });

  it('lists the amenities with their labels', () => {
    render(
      <VenueDetails
        venue={makeVenue({ amenities: ['vestiario', 'aluguel_material'] })}
      />,
    );

    const items = within(section('Comodidades')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Vestiário',
      'Aluguel de material',
    ]);
  });

  it('skips the amenities section when there are none', () => {
    render(<VenueDetails venue={makeVenue({ amenities: [] })} />);

    expect(
      screen.queryByRole('heading', { name: 'Comodidades' }),
    ).not.toBeInTheDocument();
  });

  it('lists the courts', () => {
    render(
      <VenueDetails
        venue={makeVenue({ fields: [makeField({ name: 'Quadra Central' })] })}
      />,
    );

    expect(
      within(section('Quadras')).getByRole('heading', {
        name: 'Quadra Central',
        level: 3,
      }),
    ).toBeInTheDocument();
  });

  it('shows seven days starting on Monday, with "Fechado" when a day has no hours', () => {
    render(<VenueDetails venue={makeVenue()} />);

    const rows = within(section('Horário de funcionamento')).getAllByRole(
      'term',
    );
    expect(rows.map((row) => row.textContent)).toEqual([
      'Segunda',
      'Terça',
      'Quarta',
      'Quinta',
      'Sexta',
      'Sábado',
      'Domingo',
    ]);

    const hours = within(section('Horário de funcionamento'));
    const monday = hours.getByText('Segunda').parentElement;
    const wednesday = hours.getByText('Quarta').parentElement;
    const saturday = hours.getByText('Sábado').parentElement;
    const sunday = hours.getByText('Domingo').parentElement;
    expect(monday).toHaveTextContent('08:00–22:00');
    expect(wednesday).toHaveTextContent('Fechado');
    expect(saturday).toHaveTextContent('09:00–24:00');
    expect(sunday).toHaveTextContent('Fechado');
  });

  it('lists every interval of a day, earliest first, on one line', () => {
    render(
      <VenueDetails
        venue={makeVenue({
          hours: [
            { weekday: 5, openMinute: 1020, closeMinute: 1440 },
            { weekday: 5, openMinute: 480, closeMinute: 720 },
            { weekday: 6, openMinute: 0, closeMinute: 120 },
          ],
        })}
      />,
    );

    const hours = within(section('Horário de funcionamento'));
    expect(hours.getByText('Sexta').parentElement).toHaveTextContent(
      '08:00–12:00, 17:00–24:00',
    );
    expect(hours.getByText('Sábado').parentElement).toHaveTextContent(
      '00:00–02:00',
    );
    expect(hours.getByText('Segunda').parentElement).toHaveTextContent(
      'Fechado',
    );
  });

  it('shows the cancellation policy with its label and description', () => {
    render(
      <VenueDetails venue={makeVenue({ cancellationPolicy: 'rigida' })} />,
    );

    const policy = section('Política de cancelamento');
    expect(policy).toHaveTextContent('Rígida');
    expect(policy).toHaveTextContent('Reembolso de 50% até 7 dias antes');
  });

  it('places the map on the approximate location and keeps the address hidden', () => {
    render(<VenueDetails venue={makeVenue()} />);

    const where = section('Onde fica');
    const map = within(where).getByTestId('map-stub');
    expect(map).toHaveAttribute('data-lat', '-23.55');
    expect(map).toHaveAttribute('data-lng', '-46.69');
    expect(where).toHaveTextContent(
      'Vila Madalena, São Paulo. O endereço exato aparece depois da reserva.',
    );
  });
});

describe('VenueOverview', () => {
  afterEach(() => {
    captured.demo = false;
  });

  it('says what and where, with the real facts of the court', () => {
    render(<VenueOverview venue={makeVenue({ amenities: ['coberta'] })} />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Society 7x7 em Vila Madalena, São Paulo',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Grama sintética · coberta · 40 × 20 m'),
    ).toBeInTheDocument();
  });

  it('names the host by first name only', () => {
    render(<VenueOverview venue={makeVenue()} />);

    expect(screen.getByText('Dono: Marcos')).toBeInTheDocument();
    expect(screen.getByText('M')).toHaveAttribute('aria-hidden', 'true');
  });

  it('always offers "Reserva instantânea"', () => {
    render(<VenueOverview venue={makeVenue()} />);

    expect(screen.getByText('Reserva instantânea')).toBeInTheDocument();
    expect(
      screen.getByText(
        'O horário é seu assim que o Pix cai. Sem esperar resposta do dono.',
      ),
    ).toBeInTheDocument();
  });

  it('shows no rating, badge or fictional highlight outside the demo', () => {
    render(<VenueOverview venue={makeVenue()} />);

    expect(screen.queryByText(/avaliaç/)).toBeNull();
    expect(screen.queryByText(/4,92/)).toBeNull();
    expect(screen.queryByText(/Uma das mais bem avaliadas/)).toBeNull();
    expect(screen.queryByText(/Dono destaque/)).toBeNull();
    expect(screen.queryByText('Racha no Pix')).toBeNull();
    expect(screen.queryByText('Aceita mensalista')).toBeNull();
    // One highlight, nothing left behind.
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows the prototype rating, host line and highlights in the demo', () => {
    captured.demo = true;
    render(<VenueOverview venue={makeVenue()} />);

    expect(
      screen.getByRole('link', { name: '318 avaliações' }),
    ).toHaveAttribute('href', '#avaliacoes');
    expect(
      screen.getByText('Uma das mais bem avaliadas da cidade'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Jogadores elogiam o gramado e a iluminação.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Dono destaque · responde em cerca de 10 min'),
    ).toBeInTheDocument();
    expect(screen.getByText('Racha no Pix')).toBeInTheDocument();
    expect(screen.getByText('Aceita mensalista')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('keeps a venue without demo extras free of them in the demo', () => {
    captured.demo = true;
    render(<VenueOverview venue={makeVenue({ slug: 'outro-espaco' })} />);

    expect(screen.queryByText(/avaliaç/)).toBeNull();
    expect(screen.queryByText(/Dono destaque/)).toBeNull();
  });
});

describe('VenueReviews', () => {
  afterEach(() => {
    captured.demo = false;
  });

  it('renders nothing outside the demo', () => {
    const { container } = render(<VenueReviews slug="arena-vila-madalena" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the rating, the sub-ratings and the reviews of Rafael and Camila in the demo', () => {
    captured.demo = true;
    render(<VenueReviews slug="arena-vila-madalena" />);

    const reviews = screen.getByRole('region', {
      name: '4,92 · 318 avaliações',
    });
    expect(reviews).toHaveAttribute('id', 'avaliacoes');
    expect(reviews).toHaveTextContent('Gramado4,9');
    expect(reviews).toHaveTextContent('Pontualidade5,0');
    expect(within(reviews).getByText('Rafael')).toBeInTheDocument();
    expect(within(reviews).getByText('Camila')).toBeInTheDocument();
    expect(
      within(reviews).getByText(/O gramado é o melhor da região/),
    ).toBeInTheDocument();
  });
});
