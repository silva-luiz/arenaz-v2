import { formatPrice } from '@arenaz/ui';
import L from 'leaflet';

// The pin is a price label, not a marker image: Leaflet's default PNG cannot
// be resolved by the bundler and the price is what people compare. The icon
// box has no size, so the label is centred on the point with a translate.
// Tailwind sees these class names because they are literals in this file.
const BASE =
  'inline-flex min-h-8 -translate-x-1/2 -translate-y-1/2 items-center rounded-full border px-3 text-sm font-bold whitespace-nowrap shadow-1';
const IDLE = 'border-line-strong bg-white text-ink';
const SELECTED = 'scale-110 border-ink bg-ink text-white';

const cache = new Map<string, L.DivIcon>();

/**
 * "R$ 180" pin. Icons are cached per price and state so a marker keeps the
 * same icon between renders (react-leaflet redraws a marker when it changes).
 */
export function priceIcon(cents: number, selected: boolean): L.DivIcon {
  const key = `${selected ? 's' : 'i'}:${String(cents)}`;
  let icon = cache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: '',
      // `formatPrice` only emits digits, "R$", "," and a no-break space.
      html: `<span class="${BASE} ${selected ? SELECTED : IDLE}">${formatPrice(cents)}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    cache.set(key, icon);
  }
  return icon;
}
