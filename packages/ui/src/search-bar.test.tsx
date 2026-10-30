import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchBar } from './search-bar';

type PositionCallback = (position: {
  coords: { latitude: number; longitude: number };
}) => void;
type ErrorCallback = (error: { code: number }) => void;

function mockGeolocation(
  behaviour: (success: PositionCallback, failure: ErrorCallback) => void,
) {
  const getCurrentPosition = vi.fn<
    (
      success: PositionCallback,
      failure: ErrorCallback,
      options?: PositionOptions,
    ) => void
  >((success, failure) => {
    behaviour(success, failure);
  });
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  });
  return getCurrentPosition;
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, 'geolocation');
});

describe('SearchBar', () => {
  it('is a GET form to /buscar that works without JavaScript', () => {
    render(<SearchBar />);

    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/buscar');
    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveAttribute(
      'name',
      'q',
    );
    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveAttribute(
      'placeholder',
      'Cidade ou bairro',
    );
    expect(screen.getByRole('combobox', { name: 'Esporte' })).toHaveAttribute(
      'name',
      'sport',
    );
    expect(screen.getByRole('button', { name: 'Buscar' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('lists "Qualquer esporte" and every sport label', () => {
    render(<SearchBar />);

    const options = within(screen.getByRole('combobox', { name: 'Esporte' }))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options[0]).toBe('Qualquer esporte');
    expect(options).toContain('Society');
    expect(options).toContain('Beach tennis');
    expect(options).toHaveLength(9);
  });

  it('sizes the sport segment to its content so "Qualquer esporte" is not clipped', () => {
    render(<SearchBar />);

    const select = screen.getByRole('combobox', { name: 'Esporte' });
    const segment = select.closest('label');
    // flex-none: the segment is as wide as its longest option instead of
    // sharing the row with the text field.
    expect(segment).toHaveClass('md:flex-none');
    // The visible label and the selected option both stay readable by name.
    expect(select).toHaveDisplayValue('Qualquer esporte');
  });

  it('honours action, defaultQuery and defaultSport', () => {
    render(
      <SearchBar
        action="/outra"
        defaultQuery="Pinheiros"
        defaultSport="padel"
      />,
    );

    expect(screen.getByRole('search')).toHaveAttribute('action', '/outra');
    expect(screen.getByRole('textbox', { name: 'Onde' })).toHaveValue(
      'Pinheiros',
    );
    expect(screen.getByRole('combobox', { name: 'Esporte' })).toHaveValue(
      'padel',
    );
  });

  it('submits q and sport as GET fields', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    let submitted: Record<string, FormDataEntryValue | null> = {};
    const form = screen.getByRole<HTMLFormElement>('search');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      submitted = { q: data.get('q'), sport: data.get('sport') };
    });

    await user.type(screen.getByRole('textbox', { name: 'Onde' }), 'Pinheiros');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Esporte' }),
      'padel',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(submitted).toEqual({ q: 'Pinheiros', sport: 'padel' });
  });

  it('has the four segments of the prototype: Onde, Quando, Esporte, Jogadores', () => {
    render(<SearchBar today="2026-10-29" />);

    const labels = ['Onde', 'Quando', 'Esporte', 'Jogadores'];
    for (const label of labels) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('combobox', { name: 'Quando' })).toHaveAttribute(
      'name',
      'data',
    );
    expect(screen.getByRole('combobox', { name: 'Jogadores' })).toHaveAttribute(
      'name',
      'jogadores',
    );
  });

  it('offers "Qualquer dia", today, tomorrow and the next five days as YYYY-MM-DD', () => {
    render(<SearchBar today="2026-10-29" />);

    const options = within(
      screen.getByRole('combobox', { name: 'Quando' }),
    ).getAllByRole<HTMLOptionElement>('option');
    expect(options.map((option) => [option.value, option.textContent])).toEqual(
      [
        ['', 'Qualquer dia'],
        ['2026-10-29', 'Hoje'],
        ['2026-10-30', 'Amanhã'],
        ['2026-10-31', 'Sáb, 31/10'],
        ['2026-11-01', 'Dom, 01/11'],
        ['2026-11-02', 'Seg, 02/11'],
        ['2026-11-03', 'Ter, 03/11'],
        ['2026-11-04', 'Qua, 04/11'],
      ],
    );
  });

  it('rolls the dates over the end of the year', () => {
    render(<SearchBar today="2026-12-30" />);

    const values = within(screen.getByRole('combobox', { name: 'Quando' }))
      .getAllByRole<HTMLOptionElement>('option')
      .map((option) => option.value);
    expect(values.slice(1, 4)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
    ]);
  });

  it('defaults "Quando" to today in São Paulo when no date is given', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 01:30 UTC on Oct 30 is still Oct 29 in São Paulo (UTC-3).
    vi.setSystemTime(new Date('2026-10-30T01:30:00Z'));
    render(<SearchBar />);

    const hoje = within(
      screen.getByRole('combobox', { name: 'Quando' }),
    ).getByRole<HTMLOptionElement>('option', { name: 'Hoje' });
    expect(hoje.value).toBe('2026-10-29');
  });

  it('lists "Quantos?" and 2 to 30 people', () => {
    render(<SearchBar />);

    const options = within(
      screen.getByRole('combobox', { name: 'Jogadores' }),
    ).getAllByRole<HTMLOptionElement>('option');
    expect(options[0]).toHaveTextContent('Quantos?');
    expect(options[0]?.value).toBe('');
    expect(options[1]).toHaveTextContent('2 pessoas');
    expect(options.at(-1)).toHaveTextContent('30 pessoas');
    expect(options).toHaveLength(30);
  });

  it('honours defaultDate and defaultPlayers', () => {
    render(
      <SearchBar
        today="2026-10-29"
        defaultDate="2026-10-30"
        defaultPlayers="14"
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Quando' })).toHaveValue(
      '2026-10-30',
    );
    expect(screen.getByRole('combobox', { name: 'Jogadores' })).toHaveValue(
      '14',
    );
  });

  it('offers a date beyond the next week when it comes from the URL', () => {
    render(<SearchBar today="2026-10-29" defaultDate="2026-11-20" />);

    const select = screen.getByRole('combobox', { name: 'Quando' });
    expect(select).toHaveValue('2026-11-20');
    expect(
      within(select).getByRole('option', { name: 'Sex, 20/11' }),
    ).toBeInTheDocument();
  });

  it('adds nothing for a date that is already an option', () => {
    render(<SearchBar today="2026-10-29" defaultDate="2026-10-31" />);

    expect(
      within(screen.getByRole('combobox', { name: 'Quando' })).getAllByRole(
        'option',
      ),
    ).toHaveLength(8);
  });

  it('submits the extra fields it was given, so a new search keeps the filters', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SearchBar
        today="2026-10-29"
        extraFields={{ amenities: 'coberta,vestiario', maxPrice: '200' }}
      />,
    );
    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    const submitted: string[] = [];
    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      submitted.push(
        new URLSearchParams(
          new FormData(event.target as HTMLFormElement) as unknown as Record<
            string,
            string
          >,
        ).toString(),
      );
    });
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(submitted[0]).toContain('amenities=coberta%2Cvestiario');
    expect(submitted[0]).toContain('maxPrice=200');
  });

  it('submits q, sport, data and jogadores', async () => {
    const user = userEvent.setup();
    render(<SearchBar today="2026-10-29" />);

    const form = screen.getByRole<HTMLFormElement>('search');
    let sent: [string, FormDataEntryValue][] = [];
    const onSubmit = (event: Event) => {
      event.preventDefault();
      sent = [...new FormData(form).entries()];
    };
    document.addEventListener('submit', onSubmit);

    await user.type(screen.getByRole('textbox', { name: 'Onde' }), 'Lapa');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Quando' }),
      'Hoje',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Esporte' }),
      'Society',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Jogadores' }),
      '14 pessoas',
    );
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(sent).toEqual([
      ['q', 'Lapa'],
      ['data', '2026-10-29'],
      ['sport', 'futebol_society'],
      ['jogadores', '14'],
    ]);
    document.removeEventListener('submit', onSubmit);
  });

  it('drops empty fields from the URL on submit and restores them after', async () => {
    const user = userEvent.setup();
    render(<SearchBar />);

    const form = screen.getByRole<HTMLFormElement>('search');
    let sent: string[] = [];
    // On document: bubbles after React's onSubmit, like the real submission.
    const onSubmit = (event: Event) => {
      event.preventDefault();
      sent = [...new FormData(form).keys()];
    };
    document.addEventListener('submit', onSubmit);

    const where = screen.getByRole('textbox', { name: 'Onde' });
    await user.type(where, '   ');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(sent).toEqual([]);
    await waitFor(() => {
      expect(where).toBeEnabled();
    });
    expect(screen.getByRole('combobox', { name: 'Esporte' })).toBeEnabled();

    await user.clear(where);
    await user.type(where, 'Pinheiros');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));
    expect(sent).toEqual(['q']);

    document.removeEventListener('submit', onSubmit);
  });

  describe('"Perto de mim"', () => {
    it('navigates with coordinates rounded to 3 decimals', async () => {
      const user = userEvent.setup();
      const getCurrentPosition = mockGeolocation((success) => {
        success({ coords: { latitude: -23.56149, longitude: -46.6559 } });
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(
        '/buscar?lat=-23.561&lng=-46.656',
      );
      expect(getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ timeout: 10_000 }),
      );
    });

    it('keeps the selected sport and honours action', async () => {
      const user = userEvent.setup();
      mockGeolocation((success) => {
        success({ coords: { latitude: -23.5, longitude: -46.6 } });
      });
      const onNavigate = vi.fn();
      render(<SearchBar action="/outra" onNavigate={onNavigate} />);

      await user.selectOptions(
        screen.getByRole('combobox', { name: 'Esporte' }),
        'futsal',
      );
      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(
        '/outra?lat=-23.500&lng=-46.600&sport=futsal',
      );
    });

    it('keeps the day, players and carried filters, but drops the typed place', async () => {
      const user = userEvent.setup();
      mockGeolocation((success) => {
        success({ coords: { latitude: -23.5, longitude: -46.6 } });
      });
      const onNavigate = vi.fn();
      render(
        <SearchBar
          today="2026-10-29"
          defaultQuery="Pinheiros"
          defaultDate="2026-10-30"
          defaultPlayers="10"
          extraFields={{ amenities: 'coberta,vestiario', maxPrice: '20000' }}
          onNavigate={onNavigate}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(onNavigate).toHaveBeenCalledTimes(1);
      const url = new URL(
        onNavigate.mock.calls[0]?.[0] as string,
        'http://x.test',
      );
      expect(url.pathname).toBe('/buscar');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        lat: '-23.500',
        lng: '-46.600',
        data: '2026-10-30',
        jogadores: '10',
        amenities: 'coberta,vestiario',
        maxPrice: '20000',
      });
    });

    it('shows the error when the permission is denied', async () => {
      const user = userEvent.setup();
      mockGeolocation((_success, failure) => {
        failure({ code: 1 });
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não conseguimos sua localização',
      );
      expect(onNavigate).not.toHaveBeenCalled();
      expect(
        screen.getByRole('button', { name: 'Perto de mim' }),
      ).toBeEnabled();
    });

    it('shows the error when geolocation does not exist', async () => {
      const user = userEvent.setup();
      render(<SearchBar onNavigate={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não conseguimos sua localização',
      );
    });

    it('clears the error on the next attempt', async () => {
      const user = userEvent.setup();
      let attempt = 0;
      mockGeolocation((success, failure) => {
        attempt += 1;
        if (attempt === 1) failure({ code: 1 });
        else success({ coords: { latitude: 1, longitude: 2 } });
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));
      expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos');

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();
      expect(onNavigate).toHaveBeenCalledExactlyOnceWith(
        '/buscar?lat=1.000&lng=2.000',
      );
    });

    it('does not stay disabled: a never-answered request falls back after 12 s', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      mockGeolocation(() => {
        // Firefox: dismissing the permission prompt fires no callback.
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      const button = screen.getByRole('button', { name: 'Perto de mim' });
      await user.click(button);

      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Buscando sua localização…')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();

      act(() => {
        vi.advanceTimersByTime(11_000);
      });
      expect(screen.getByRole('alert')).toBeEmptyDOMElement();

      act(() => {
        vi.advanceTimersByTime(1_500);
      });
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Não conseguimos sua localização',
      );
      expect(button).not.toHaveAttribute('aria-busy');
      expect(screen.queryByText('Buscando sua localização…')).toBeNull();
      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('announces the wait in a polite live region', async () => {
      const user = userEvent.setup();
      mockGeolocation(() => {
        // never answers
      });
      render(<SearchBar onNavigate={vi.fn()} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));

      const status = screen.getByText('Buscando sua localização…');
      expect(status).toHaveAttribute('aria-live', 'polite');
    });

    it('makes a single request on a double click', async () => {
      const user = userEvent.setup();
      const getCurrentPosition = mockGeolocation(() => {
        // pending
      });
      render(<SearchBar onNavigate={vi.fn()} />);

      const button = screen.getByRole('button', { name: 'Perto de mim' });
      await user.dblClick(button);

      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it('ignores a late answer after the fallback fired', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      let late: PositionCallback = () => undefined;
      mockGeolocation((success) => {
        late = success;
      });
      const onNavigate = vi.fn();
      render(<SearchBar onNavigate={onNavigate} />);

      await user.click(screen.getByRole('button', { name: 'Perto de mim' }));
      act(() => {
        vi.advanceTimersByTime(12_500);
      });
      late({ coords: { latitude: 1, longitude: 2 } });

      expect(onNavigate).not.toHaveBeenCalled();
    });

    it('can try again after the fallback', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const getCurrentPosition = mockGeolocation(() => undefined);
      render(<SearchBar onNavigate={vi.fn()} />);

      const button = screen.getByRole('button', { name: 'Perto de mim' });
      await user.click(button);
      act(() => {
        vi.advanceTimersByTime(12_500);
      });
      await user.click(button);

      expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    });

    it('is a plain button that never submits the form', () => {
      render(<SearchBar />);
      expect(
        screen.getByRole('button', { name: 'Perto de mim' }),
      ).toHaveAttribute('type', 'button');
    });
  });
});
