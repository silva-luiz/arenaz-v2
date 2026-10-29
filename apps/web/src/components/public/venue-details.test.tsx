import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Leaflet needs a real browser; the map has its own tests.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub(props: { lat: number; lng: number }) {
      return (
        <div data-testid="map-stub" data-lat={props.lat} data-lng={props.lng} />
      );
    },
}));

import { VenueDetails } from './venue-details';
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
    expect(monday).toHaveTextContent('08:00 – 22:00');
    expect(wednesday).toHaveTextContent('Fechado');
    expect(saturday).toHaveTextContent('09:00 – 24:00');
    expect(sunday).toHaveTextContent('Fechado');
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

  it('names the host by first name only', () => {
    render(<VenueDetails venue={makeVenue()} />);

    expect(screen.getByText('Dono: Marcos')).toBeInTheDocument();
  });
});
