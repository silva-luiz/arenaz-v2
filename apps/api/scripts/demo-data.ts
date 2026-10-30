// Pure data of the demo seed: the 13 venues of the approved prototype
// (docs/design/prototipo/Main.dc.html and Busca.dc.html). No imports at
// runtime, so Node can run it as is. Nothing here is an invented statistic:
// no ratings, no review counts (those live in the web's demo module).
import type { Amenity, FieldFormat, Sport, Surface } from '@arenaz/contracts';

export const DEMO_OWNER = {
  email: 'marcos@demo.arenaz.test',
  name: 'Marcos Silva',
} as const;

export const DEMO_PLAYER = {
  email: 'jogador@demo.arenaz.test',
  name: 'Gabriel Ribeiro',
} as const;

export const DEMO_TIMEZONE = 'America/Sao_Paulo';
/** 07:00 to 24:00 every day (`close_minute` 1440 is midnight). */
export const DEMO_OPEN_MINUTE = 7 * 60;
export const DEMO_CLOSE_MINUTE = 24 * 60;

/** A confirmed booking of today (`day` 0) or tomorrow (`day` 1). */
export interface DemoBooking {
  day: 0 | 1;
  /** Local start, HH:MM. */
  start: string;
  minutes: number;
  /** Absent = made in the app by the demo player; present = manual booking. */
  customer?: string;
}

export interface DemoVenue {
  slug: string;
  name: string;
  description: string;
  /** File names (without .jpg) in infra/demo/photos; the first is the cover. */
  photos: readonly string[];
  neighborhood: string;
  street: string;
  number: string;
  /** Eight digits. */
  cep: string;
  phone: string;
  lat: number;
  lng: number;
  amenities: readonly Amenity[];
  field: {
    name: string;
    sports: readonly Sport[];
    surface: Surface;
    format: FieldFormat | null;
    lengthM: number;
    widthM: number;
    basePriceCents: number;
    /** Price band applied every day. */
    peak?: { startMinute: number; endMinute: number; priceCents: number };
  };
  bookings: readonly DemoBooking[];
}

/** Order of the gallery on Quadra.dc.html. */
const VILA_MADALENA_GALLERY = [
  'society-night',
  'ball-turf',
  'society-aerial',
  'warmup',
  'hero-night',
] as const;

export const DEMO_VENUES: readonly DemoVenue[] = [
  {
    slug: 'arena-vila-madalena',
    name: 'Arena Vila Madalena',
    description:
      'Society coberto e iluminado, ótimo para o jogo da noite. Gramado sintético e vestiário no local.',
    photos: VILA_MADALENA_GALLERY,
    neighborhood: 'Vila Madalena',
    street: 'Rua Fradique Coutinho',
    number: '480',
    cep: '05416011',
    phone: '(11) 90000-0001',
    lat: -23.5546,
    lng: -46.6911,
    amenities: ['coberta', 'iluminacao', 'vestiario'],
    field: {
      name: 'Society 1',
      sports: ['futebol_society'],
      surface: 'grama_sintetica',
      format: '7x7',
      lengthM: 50,
      widthM: 30,
      basePriceCents: 18000,
      peak: { startMinute: 19 * 60, endMinute: 23 * 60, priceCents: 22000 },
    },
    bookings: [
      { day: 0, start: '17:00', minutes: 60, customer: 'Rafael' },
      { day: 0, start: '18:00', minutes: 60 },
      { day: 0, start: '19:00', minutes: 60, customer: 'Pelada da Firma' },
      { day: 1, start: '18:00', minutes: 60, customer: 'Time do Bruno' },
      { day: 1, start: '20:00', minutes: 120 },
    ],
  },
  {
    slug: 'society-pinheiros',
    name: 'Society Pinheiros',
    description:
      'Campo society com refletores e bar ao lado do campo. Bom para rachas depois do trabalho.',
    photos: ['society-aerial'],
    neighborhood: 'Pinheiros',
    street: 'Rua Cardeal Arcoverde',
    number: '1250',
    cep: '05407002',
    phone: '(11) 90000-0002',
    lat: -23.567,
    lng: -46.6924,
    amenities: ['bar', 'iluminacao'],
    field: {
      name: 'Society 1',
      sports: ['futebol_society'],
      surface: 'grama_sintetica',
      format: '7x7',
      lengthM: 50,
      widthM: 30,
      basePriceCents: 19000,
    },
    bookings: [
      { day: 0, start: '20:00', minutes: 60, customer: 'Racha do Léo' },
      { day: 0, start: '21:00', minutes: 60 },
      { day: 1, start: '19:00', minutes: 60, customer: 'Turma da Faculdade' },
    ],
  },
  {
    slug: 'pacaembu-futsal-club',
    name: 'Pacaembu Futsal Club',
    description:
      'Quadra de futsal com piso de taco e vestiário. Jogo rápido, quadra bem cuidada.',
    photos: ['futsal-match'],
    neighborhood: 'Pacaembu',
    street: 'Rua Capivari',
    number: '210',
    cep: '01246020',
    phone: '(11) 90000-0003',
    lat: -23.5368,
    lng: -46.6641,
    amenities: ['vestiario', 'iluminacao'],
    field: {
      name: 'Quadra 1',
      sports: ['futsal'],
      surface: 'madeira',
      format: null,
      lengthM: 40,
      widthM: 20,
      basePriceCents: 14000,
    },
    bookings: [
      { day: 0, start: '20:00', minutes: 60, customer: 'Futsal dos Amigos' },
      { day: 0, start: '22:00', minutes: 60 },
      { day: 1, start: '20:00', minutes: 60, customer: 'Rafael' },
    ],
  },
  {
    slug: 'quadra-coberta-perdizes',
    name: 'Quadra Coberta Perdizes',
    description:
      'Quadra poliesportiva coberta, joga chova ou faça sol. Piso rígido para futsal e outros esportes de quadra.',
    photos: ['poli'],
    neighborhood: 'Perdizes',
    street: 'Rua Cardoso de Almeida',
    number: '830',
    cep: '05013001',
    phone: '(11) 90000-0004',
    lat: -23.5333,
    lng: -46.6794,
    amenities: ['coberta', 'iluminacao'],
    field: {
      name: 'Quadra 1',
      sports: ['futsal'],
      surface: 'piso_rigido',
      format: null,
      lengthM: 38,
      widthM: 19,
      basePriceCents: 12000,
    },
    bookings: [
      { day: 0, start: '19:00', minutes: 60, customer: 'Escolinha da Vila' },
      { day: 0, start: '20:00', minutes: 120, customer: 'Pelada da Firma' },
      { day: 1, start: '21:00', minutes: 60 },
    ],
  },
  {
    slug: 'arena-lapa-7',
    name: 'Arena Lapa 7',
    description:
      'Campo de grama sintética com arquibancada e bar. Society 7x7 para a turma toda.',
    photos: ['field-top'],
    neighborhood: 'Lapa',
    street: 'Rua Catão',
    number: '620',
    cep: '05049000',
    phone: '(11) 90000-0005',
    lat: -23.5226,
    lng: -46.7036,
    amenities: ['bar', 'iluminacao'],
    field: {
      name: 'Society 1',
      sports: ['futebol_society'],
      surface: 'grama_sintetica',
      format: '7x7',
      lengthM: 50,
      widthM: 30,
      basePriceCents: 20000,
    },
    bookings: [
      { day: 0, start: '19:00', minutes: 120, customer: 'Os Boleiros' },
      { day: 0, start: '22:00', minutes: 60 },
      { day: 1, start: '20:00', minutes: 60, customer: 'Rafael' },
    ],
  },
  {
    slug: 'campo-ibirapuera-fc',
    name: 'Campo Ibirapuera FC',
    description:
      'Campo de grama natural em tamanho oficial, com árvores ao redor. Para jogos de 11 contra 11.',
    photos: ['open-field'],
    neighborhood: 'Ibirapuera',
    street: 'Avenida Pedro Álvares Cabral',
    number: '300',
    cep: '04094050',
    phone: '(11) 90000-0006',
    lat: -23.5874,
    lng: -46.6576,
    amenities: ['vestiario', 'estacionamento'],
    field: {
      name: 'Campo 1',
      sports: ['futebol_campo'],
      surface: 'grama_natural',
      format: '11x11',
      lengthM: 100,
      widthM: 64,
      basePriceCents: 42000,
    },
    bookings: [
      { day: 0, start: '18:00', minutes: 120, customer: 'Amistoso do Bairro' },
      { day: 1, start: '20:00', minutes: 120 },
    ],
  },
  {
    slug: 'futevolei-praia-urbana',
    name: 'Futevôlei Praia Urbana',
    description:
      'Quadra de areia no meio da cidade para futevôlei. Rede e marcações prontas para jogar.',
    photos: ['futevolei'],
    neighborhood: 'Barra Funda',
    street: 'Rua Brigadeiro Galvão',
    number: '150',
    cep: '01151000',
    phone: '(11) 90000-0007',
    lat: -23.5262,
    lng: -46.6663,
    amenities: ['chuveiro', 'bar'],
    field: {
      name: 'Quadra de areia 1',
      sports: ['futevolei'],
      surface: 'areia',
      format: null,
      lengthM: 18,
      widthM: 9,
      basePriceCents: 9000,
    },
    bookings: [
      { day: 0, start: '18:00', minutes: 60, customer: 'Dupla Rafa e Bia' },
      { day: 0, start: '19:00', minutes: 60 },
      { day: 1, start: '17:00', minutes: 60, customer: 'Rafael' },
    ],
  },
  {
    slug: 'padel-pinheiros',
    name: 'Padel Pinheiros',
    description:
      'Quadra de padel com paredes de vidro e piso azul. Reserve por hora e traga a dupla.',
    photos: ['padel-court'],
    neighborhood: 'Pinheiros',
    street: 'Rua dos Pinheiros',
    number: '900',
    cep: '05422001',
    phone: '(11) 90000-0008',
    lat: -23.5655,
    lng: -46.699,
    amenities: ['iluminacao', 'vestiario'],
    field: {
      name: 'Quadra de padel 1',
      sports: ['padel'],
      surface: 'piso_rigido',
      format: null,
      lengthM: 20,
      widthM: 10,
      basePriceCents: 16000,
    },
    bookings: [
      { day: 0, start: '19:00', minutes: 60 },
      { day: 0, start: '20:00', minutes: 60, customer: 'Marina e Paulo' },
      { day: 1, start: '19:00', minutes: 60, customer: 'Rafael' },
    ],
  },
  {
    slug: 'beach-lapa-sunset',
    name: 'Beach Lapa Sunset',
    description:
      'Quadra de areia para beach tennis e vôlei de praia, com bom pôr do sol no fim da tarde.',
    photos: ['beach-sunset'],
    neighborhood: 'Lapa',
    street: 'Rua Guaicurus',
    number: '75',
    cep: '05033000',
    phone: '(11) 90000-0009',
    lat: -23.529,
    lng: -46.701,
    amenities: ['bar', 'chuveiro'],
    field: {
      name: 'Quadra de areia 1',
      sports: ['beach_tennis', 'volei_praia'],
      surface: 'areia',
      format: null,
      lengthM: 16,
      widthM: 8,
      basePriceCents: 8000,
    },
    // No bookings on purpose: unpublishing is refused while a venue has
    // upcoming ones, so this is the venue that shows Despublicar live.
    bookings: [],
  },
  {
    slug: 'saibro-butanta',
    name: 'Saibro Butantã',
    description:
      'Quadra de tênis de saibro com rede nova e piso bem cuidado. Aulas e jogos por hora.',
    photos: ['clay-net'],
    neighborhood: 'Butantã',
    street: 'Avenida Corifeu de Azevedo Marques',
    number: '1500',
    cep: '05340000',
    phone: '(11) 90000-0010',
    lat: -23.571,
    lng: -46.709,
    amenities: ['vestiario', 'estacionamento'],
    field: {
      name: 'Quadra de saibro 1',
      sports: ['tenis'],
      surface: 'saibro',
      format: null,
      lengthM: 36,
      widthM: 18,
      basePriceCents: 11000,
    },
    bookings: [
      { day: 0, start: '18:00', minutes: 60, customer: 'Aula do Prof. Tiago' },
      { day: 0, start: '19:00', minutes: 60, customer: 'Rafael' },
      { day: 1, start: '08:00', minutes: 60 },
    ],
  },
  {
    slug: 'raquete-clube-sumare',
    name: 'Raquete Clube Sumaré',
    description:
      'Quadra de padel com aluguel de raquetes e bolas no local. Ideal para quem quer experimentar.',
    photos: ['padel-rackets'],
    neighborhood: 'Sumaré',
    street: 'Avenida Sumaré',
    number: '1100',
    cep: '01250000',
    phone: '(11) 90000-0011',
    lat: -23.5455,
    lng: -46.676,
    amenities: ['aluguel_material', 'vestiario'],
    field: {
      name: 'Quadra de padel 1',
      sports: ['padel'],
      surface: 'piso_rigido',
      format: null,
      lengthM: 20,
      widthM: 10,
      basePriceCents: 15000,
    },
    bookings: [
      { day: 0, start: '20:00', minutes: 60 },
      { day: 0, start: '21:00', minutes: 60, customer: 'Rafael' },
      { day: 1, start: '19:00', minutes: 60, customer: 'Time da Empresa' },
    ],
  },
  {
    slug: 'futsal-ball-mooca',
    name: 'Futsal Ball Mooca',
    description:
      'Quadra de futsal coberta, com gol e marcações novas. Jogue à noite sem depender do tempo.',
    photos: ['futsal-ball'],
    neighborhood: 'Mooca',
    street: 'Rua da Mooca',
    number: '2100',
    cep: '03103002',
    phone: '(11) 90000-0012',
    lat: -23.559,
    lng: -46.5985,
    amenities: ['coberta', 'iluminacao'],
    field: {
      name: 'Quadra 1',
      sports: ['futsal'],
      surface: 'piso_rigido',
      format: null,
      lengthM: 40,
      widthM: 20,
      basePriceCents: 13000,
    },
    bookings: [
      { day: 0, start: '21:00', minutes: 60, customer: 'Racha da Mooca' },
      { day: 1, start: '20:00', minutes: 60 },
    ],
  },
  {
    slug: 'sumare-society',
    name: 'Sumaré Society',
    description:
      'Society 6x6 com estacionamento no local. Campo de grama sintética para o time se aquecer e jogar.',
    photos: ['warmup'],
    neighborhood: 'Sumaré',
    street: 'Rua Heitor Penteado',
    number: '1700',
    cep: '05437001',
    phone: '(11) 90000-0013',
    lat: -23.543,
    lng: -46.683,
    amenities: ['estacionamento', 'iluminacao'],
    field: {
      name: 'Society 1',
      sports: ['futebol_society'],
      surface: 'grama_sintetica',
      format: '6x6',
      lengthM: 42,
      widthM: 24,
      basePriceCents: 15000,
    },
    bookings: [
      { day: 0, start: '19:00', minutes: 60, customer: 'Pelada do Prédio' },
      { day: 0, start: '21:00', minutes: 60 },
      { day: 1, start: '20:00', minutes: 60, customer: 'Rafael' },
    ],
  },
];
