export const SPORTS = [
  'futebol_society',
  'futsal',
  'futebol_campo',
  'beach_tennis',
  'futevolei',
  'volei_praia',
  'padel',
  'tenis',
] as const;
export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  futebol_society: 'Society',
  futsal: 'Futsal',
  futebol_campo: 'Campo',
  beach_tennis: 'Beach tennis',
  futevolei: 'Futevôlei',
  volei_praia: 'Vôlei de praia',
  padel: 'Padel',
  tenis: 'Tênis',
};

export const SURFACES = [
  'grama_sintetica',
  'grama_natural',
  'areia',
  'saibro',
  'piso_rigido',
  'madeira',
] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_LABELS: Record<Surface, string> = {
  grama_sintetica: 'Grama sintética',
  grama_natural: 'Grama natural',
  areia: 'Areia',
  saibro: 'Saibro',
  piso_rigido: 'Piso rígido',
  madeira: 'Madeira',
};

export const FIELD_FORMATS = ['5x5', '6x6', '7x7', '8x8', '11x11'] as const;
export type FieldFormat = (typeof FIELD_FORMATS)[number];

export const AMENITIES = [
  'vestiario',
  'chuveiro',
  'estacionamento',
  'iluminacao',
  'bar',
  'churrasqueira',
  'coberta',
  'acessibilidade',
  'wifi',
  'aluguel_material',
] as const;
export type Amenity = (typeof AMENITIES)[number];

export const AMENITY_LABELS: Record<Amenity, string> = {
  vestiario: 'Vestiário',
  chuveiro: 'Chuveiro',
  estacionamento: 'Estacionamento',
  iluminacao: 'Iluminação',
  bar: 'Bar',
  churrasqueira: 'Churrasqueira',
  coberta: 'Coberta',
  acessibilidade: 'Acessibilidade',
  wifi: 'Wi-Fi',
  aluguel_material: 'Aluguel de material',
};

export const CANCELLATION_POLICIES = [
  'flexivel',
  'moderada',
  'rigida',
] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

export const CANCELLATION_POLICY_LABELS: Record<CancellationPolicy, string> = {
  flexivel: 'Flexível',
  moderada: 'Moderada',
  rigida: 'Rígida',
};

export const CANCELLATION_POLICY_DESCRIPTIONS: Record<
  CancellationPolicy,
  string
> = {
  flexivel: 'Reembolso total até 24h antes',
  moderada: 'Reembolso total até 48h antes',
  rigida: 'Reembolso de 50% até 7 dias antes',
};

export const UF = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
export type Uf = (typeof UF)[number];

/** Index = weekday number, 0 = Sunday (same as `Date#getDay`). */
export const WEEKDAY_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
] as const;
