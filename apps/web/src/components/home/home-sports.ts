import { AMENITY_LABELS, SPORT_LABELS, type Sport } from '@arenaz/contracts';

/**
 * The picks of the home's sport row (Main.dc.html `cats`), in the prototype's
 * order. "Coberta" is not a sport: it asks for the `coberta` amenity.
 */
export interface HomeSport {
  id: string;
  label: string;
  /** 128px thumbnail in /public/esportes. */
  image: string;
  /** The `/venues` filter this pick stands for. */
  filter: { sport: Sport } | { amenities: 'coberta' };
}

function sport(id: string, value: Sport): HomeSport {
  return {
    id,
    label: SPORT_LABELS[value],
    image: `/esportes/${id}.jpg`,
    filter: { sport: value },
  };
}

export const HOME_SPORTS: readonly HomeSport[] = [
  sport('society', 'futebol_society'),
  sport('futsal', 'futsal'),
  sport('campo', 'futebol_campo'),
  sport('futevolei', 'futevolei'),
  sport('beach', 'beach_tennis'),
  sport('padel', 'padel'),
  sport('tenis', 'tenis'),
  {
    id: 'coberta',
    label: AMENITY_LABELS.coberta,
    image: '/esportes/coberta.jpg',
    filter: { amenities: 'coberta' },
  },
];

/** The pick the home opens with (Society, as in the prototype). */
export const DEFAULT_HOME_SPORT = HOME_SPORTS[0] as HomeSport;

/** "sport=futsal" / "amenities=coberta": the query of `/venues` and `/buscar`. */
export function homeSportQuery(pick: HomeSport): string {
  return new URLSearchParams(pick.filter).toString();
}

/** "Areia, raquete e sol pro fim de semana", in the prototype's order. */
export const WEEKEND_SPORTS: readonly Sport[] = [
  'futevolei',
  'padel',
  'beach_tennis',
  'tenis',
  'volei_praia',
];
