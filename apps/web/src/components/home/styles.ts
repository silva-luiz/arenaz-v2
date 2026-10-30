/** Focus ring over dark photos and bands (the brand green would not show). */
export const WHITE_FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

/**
 * Avatar colours of the prototype's player faces. The prototype's orange
 * (#B5651D, 4.3:1 under white initials) is darkened to #A65C18 (5.0:1).
 */
export const FACE_TONES = [
  '#2D6A4F',
  '#A65C18',
  '#3D5A98',
  '#8E3B5F',
  '#5A5A5A',
] as const;

/*
 * Cover `sizes` of the home cards. The content is 100vw minus the page
 * gutters (16px, 40px from md) up to 1360px. Rail columns: 78% below md,
 * 3 per view to 1100px, 6 per view above, 22px gaps.
 */
export const RAIL_CARD_SIZES =
  '(min-width: 1360px) 195px, (min-width: 1101px) calc(16.67vw - 32px), (min-width: 768px) calc(33.33vw - 41px), calc(78vw - 25px)';

/** The mobile "Livre agora" card: the whole content width (md:hidden). */
export const BIG_CARD_SIZES = 'calc(100vw - 32px)';
