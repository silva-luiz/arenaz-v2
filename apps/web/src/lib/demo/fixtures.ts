/**
 * Fictional data for the demo mode (NEXT_PUBLIC_DEMO_MODE=true) and nothing
 * else. Numbers and texts are copied from the approved prototype
 * (docs/design/prototipo/*.dc.html); only `index.ts` exposes them, and only
 * when the mode is on. Never import this file from a screen directly.
 */

export interface DemoReview {
  author: string;
  initials: string;
  /** Avatar background (white initials on top; all pass 4.5:1). */
  color: string;
  /** "Mensalista há 6 meses", "Jogou em outubro". */
  context: string;
  text: string;
}

export interface DemoSubRating {
  label: string;
  /** pt-BR, one decimal: "4,9". */
  value: string;
}

export interface DemoVenueExtras {
  /** pt-BR, two decimals: "4,92". */
  rating: string;
  reviewsCount: number;
  /** Glass pill on the photo ("Preferido da galera"). */
  badge?: string;
  /** Line under the owner's name on the venue page. */
  hostHighlight?: string;
  /** What players praise, beside "Uma das mais bem avaliadas da cidade". */
  praise?: string;
  reviews: DemoReview[];
  subRatings: DemoSubRating[];
}

export interface DemoOpenGame {
  id: string;
  title: string;
  /** Venue and format, free text ("Arena Vila Madalena · society 7x7"). */
  place: string;
  /** "Hoje · 21h", "Sex · 18h30". */
  when: string;
  missingCount: number;
  /** Each player's share, in cents. */
  shareCents: number;
  /** Initials of the players already in. */
  players: string[];
  /** Name of the photo in infra/demo/photos (without `.jpg`). */
  photo: 'women' | 'street' | 'warmup' | 'covered';
  photoAlt: string;
}

export interface DemoOwnerStats {
  payoutCents: number;
  /** "dd/mm" of the next payout. */
  payoutDay: string;
  monthlyTeams: number;
  renewingThisWeek: number;
}

const HOST_HIGHLIGHT = 'Dono destaque · responde em cerca de 10 min';

/** Venues whose review texts and sub-ratings the prototype does not show. */
function withoutText(
  rating: string,
  reviewsCount: number,
  badge?: string,
): DemoVenueExtras {
  return {
    rating,
    reviewsCount,
    ...(badge ? { badge } : {}),
    hostHighlight: HOST_HIGHLIGHT,
    reviews: [],
    subRatings: [],
  };
}

/**
 * Keyed by the slugs of the demo seed (apps/api/scripts/demo-data.ts).
 *
 * Ratings, review counts and badges are the prototype's. The prototype only
 * shows a count for six of the venues (Busca) and the reviews and sub-ratings
 * of one (Quadra); the other counts are invented in the same range, and the
 * other venues have no review texts.
 */
export const DEMO_VENUE_EXTRAS: Readonly<Record<string, DemoVenueExtras>> = {
  'arena-vila-madalena': {
    rating: '4,92',
    reviewsCount: 318,
    hostHighlight: HOST_HIGHLIGHT,
    praise: 'Jogadores elogiam o gramado e a iluminação.',
    subRatings: [
      { label: 'Gramado', value: '4,9' },
      { label: 'Iluminação', value: '5,0' },
      { label: 'Vestiário', value: '4,7' },
      { label: 'Pontualidade', value: '5,0' },
    ],
    reviews: [
      {
        author: 'Rafael',
        initials: 'RL',
        color: '#3D5A98',
        context: 'Mensalista há 6 meses',
        text: 'O gramado é o melhor da região e a cobrança no Pix acabou com o drama de quem não pagou.',
      },
      {
        author: 'Camila',
        initials: 'CA',
        color: '#B5651D',
        context: 'Jogou em outubro',
        text: 'Reservei às 18h pra jogar às 20h e estava tudo pronto. Vestiário limpo; só faltou ventilação.',
      },
    ],
  },
  'society-pinheiros': withoutText('4,87', 152),
  'pacaembu-futsal-club': withoutText('4,88', 96),
  'quadra-coberta-perdizes': withoutText('4,79', 61),
  'arena-lapa-7': withoutText('4,81', 204),
  'campo-ibirapuera-fc': withoutText('4,76', 47),
  'futevolei-praia-urbana': withoutText('4,95', 241, 'Preferido da galera'),
  'padel-pinheiros': withoutText('4,97', 183),
  'beach-lapa-sunset': withoutText('4,85', 129),
  'saibro-butanta': withoutText('4,94', 74, 'Preferido da galera'),
  'raquete-clube-sumare': withoutText('4,83', 112),
  'futsal-ball-mooca': withoutText('4,80', 58),
  'sumare-society': withoutText('4,76', 88),
};

/** "Falta gente" (Main and MobileHome `games`). */
export const DEMO_OPEN_GAMES: readonly DemoOpenGame[] = [
  {
    id: 'fut-feminino-quarta',
    title: 'Fut feminino de quarta',
    place: 'Arena Vila Madalena · society 7x7',
    when: 'Hoje · 21h',
    missingCount: 2,
    shareCents: 1500,
    players: ['AL', 'BR', 'CM', 'DS'],
    photo: 'women',
    photoAlt: 'Mulheres jogando futebol em grama sintética',
  },
  {
    id: 'racha-butanta',
    title: 'Racha do Butantã',
    place: 'Quadra Butantã · futsal ao ar livre',
    when: 'Hoje · 20h',
    missingCount: 1,
    shareCents: 1200,
    players: ['JP', 'RL', 'MT'],
    photo: 'street',
    photoAlt: 'Jovens jogando futsal em quadra externa',
  },
  {
    id: 'society-quinta',
    title: 'Society de quinta',
    place: 'Society Pinheiros · 7x7',
    when: 'Amanhã · 19h30',
    missingCount: 3,
    shareCents: 1800,
    players: ['GR', 'LH', 'BM', 'FS'],
    photo: 'warmup',
    photoAlt: 'Time se aquecendo em campo sintético',
  },
  {
    id: 'futsal-pos-trampo',
    title: 'Futsal coberto pós-trampo',
    place: 'Pacaembu Futsal Club',
    when: 'Sex · 18h30',
    missingCount: 4,
    shareCents: 1400,
    players: ['VC', 'TA', 'NK'],
    photo: 'covered',
    photoAlt: 'Pessoas jogando futsal em quadra coberta',
  },
];

/** Painel: "Repasse de sexta R$ 3.120 · Cai na conta 30/10", "12 times · 2 renovam". */
export const DEMO_OWNER_STATS: DemoOwnerStats = {
  payoutCents: 312_000,
  payoutDay: '30/10',
  monthlyTeams: 12,
  renewingThisWeek: 2,
};

/** Main: "312 quadras com horário livre hoje", "27 partidas abertas agora". */
export const DEMO_MARKETING_COUNTERS = {
  freeCourtsToday: 312,
  openGames: 27,
} as const;
