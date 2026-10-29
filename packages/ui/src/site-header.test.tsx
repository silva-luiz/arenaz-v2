import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteHeader, initials } from './site-header';

describe('initials', () => {
  it.each([
    ['Gabriel Ribeiro', 'GR'],
    ['  gabriel   de souza ribeiro ', 'GR'],
    ['maria', 'M'],
    ['', ''],
    ['   ', ''],
  ])('%j -> %j', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('SiteHeader', () => {
  it('shows the initials linking to the account when signed in', () => {
    render(<SiteHeader user={{ name: 'Gabriel Ribeiro' }} />);
    const account = screen.getByRole('link', { name: 'Minha conta (GR)' });
    expect(account).toHaveAttribute('href', '/conta');
    expect(account).toHaveTextContent('GR');
    expect(screen.queryByRole('link', { name: 'Entrar' })).toBeNull();
  });

  it('offers "Entrar" without a user', () => {
    render(<SiteHeader user={null} />);
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/entrar',
    );
    expect(screen.queryByRole('link', { name: /Minha conta/ })).toBeNull();
  });

  it('links the logo home and the owner call to action to /painel', () => {
    render(<SiteHeader user={null} />);
    expect(
      screen.getByRole('link', { name: 'ArenaZ, início' }),
    ).toHaveAttribute('href', '/');
    expect(
      screen.getByRole('link', { name: 'Anuncie sua quadra' }),
    ).toHaveAttribute('href', '/painel');
  });

  it('keeps the owner link reachable on mobile with a short visible label', () => {
    render(<SiteHeader user={null} />);
    const link = screen.getByRole('link', { name: 'Anuncie sua quadra' });
    // The link itself is never hidden; only the tail of its text is.
    expect(link.className).not.toMatch(/hidden/);
    expect(link).toHaveTextContent('Anuncie');
    const tail = screen.getByText('sua quadra');
    expect(tail).toHaveClass('max-md:hidden');
    // A plain leading space is dropped inside the flex link ("Anunciesua").
    expect(link.textContent).toBe('Anuncie sua quadra');
  });

  it('names the account link without initials when the name is empty', () => {
    render(<SiteHeader user={{ name: '  ' }} />);
    expect(screen.getByRole('link', { name: 'Minha conta' })).toBeVisible();
  });

  it('is sticky and renders the search slot', () => {
    render(
      <SiteHeader user={null}>
        <div>Busca compacta</div>
      </SiteHeader>,
    );
    expect(screen.getByRole('banner')).toHaveClass('sticky', 'top-0');
    expect(screen.getByText('Busca compacta')).toBeVisible();
  });

  it('uses the injected link component for every link', () => {
    function Custom(props: React.ComponentProps<'a'>) {
      return <a data-custom="yes" {...props} />;
    }
    render(<SiteHeader user={null} linkComponent={Custom} />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(3);
    links.forEach((link) => {
      expect(link).toHaveAttribute('data-custom', 'yes');
    });
  });

  it('shows no badge by default and a tag next to the logo when given', () => {
    const { rerender } = render(<SiteHeader user={null} />);
    expect(screen.queryByText('DONO')).toBeNull();

    rerender(<SiteHeader user={null} badge="DONO" />);
    const badge = screen.getByText('DONO');
    expect(badge).toBeVisible();
    // Beside the logo link, not inside it: the link keeps its own name.
    expect(
      screen.getByRole('link', { name: 'ArenaZ, início' }),
    ).not.toContainElement(badge);
  });

  it('can leave out the owner call to action', () => {
    render(<SiteHeader user={null} showOwnerCta={false} />);
    expect(
      screen.queryByRole('link', { name: 'Anuncie sua quadra' }),
    ).toBeNull();
    expect(screen.getByRole('link', { name: 'Entrar' })).toBeVisible();
  });
});
