/**
 * What the two floating cards of the home hero show: a confirmed booking and
 * a team splitting the bill ("racha") in Pix.
 *
 * {@link HERO_SHOWCASE_MOCK} is the illustration everyone sees first. For a
 * signed-in player `useHeroShowcase` swaps the booking for their next
 * confirmed one; the racha stays the illustration until real split payments
 * exist (Plano 5). The cards only read this shape.
 */
export interface HeroBookingShowcase {
  venueName: string;
  /** Already formatted, e.g. "Hoje · 20h às 22h · quadra 2". */
  when: string;
  /** Short booking code, e.g. "#AZ-4821". */
  code: string;
  photoUrl: string;
}

export interface HeroRachaShowcase {
  /** Each player's share, in cents. */
  perPersonCents: number;
  paid: number;
  total: number;
  /** Initials of the first players who paid (up to 5 are drawn). */
  payers: readonly string[];
}

export interface HeroShowcase {
  booking: HeroBookingShowcase;
  racha: HeroRachaShowcase;
}

export const HERO_SHOWCASE_MOCK: HeroShowcase = {
  booking: {
    venueName: 'Arena Vila Madalena',
    when: 'Hoje · 20h às 22h · quadra 2',
    code: '#AZ-4821',
    photoUrl: '/home/reserva-confirmada.jpg',
  },
  racha: {
    perPersonCents: 3300,
    paid: 9,
    total: 14,
    payers: ['GR', 'AL', 'JP', 'MT', 'BS'],
  },
};
