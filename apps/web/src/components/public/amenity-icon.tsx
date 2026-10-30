import type { Amenity } from '@arenaz/contracts';
import type { ReactNode } from 'react';

const PATHS: Record<Amenity, ReactNode> = {
  vestiario: (
    <>
      <path d="M12 7.5V6a2 2 0 1 1 2 2" />
      <path d="M12 7.5 21 14a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 14l9-6.5Z" />
    </>
  ),
  chuveiro: (
    <>
      <path d="M5 12a7 7 0 0 1 14 0Z" />
      <path d="M12 5V3" />
      <path d="M8 16v2M12 16v3M16 16v2" />
    </>
  ),
  estacionamento: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M9.5 17V7.5h3.2a2.7 2.7 0 0 1 0 5.4H9.5" />
    </>
  ),
  iluminacao: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z" />
    </>
  ),
  bar: (
    <>
      <path d="M6 4h10v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
      <path d="M16 8h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" />
      <path d="M9 8v8M13 8v8" />
    </>
  ),
  churrasqueira: (
    <>
      <path d="M3 11h18a9 9 0 0 1-18 0Z" />
      <path d="m8 20 1.5-3M16 20l-1.5-3" />
      <path d="M9 7c0-1.5 1.5-1.5 1.5-3M14 7c0-1.5 1.5-1.5 1.5-3" />
    </>
  ),
  coberta: (
    <>
      <path d="M3 11a9 9 0 0 1 18 0Z" />
      <path d="M12 11v7a2 2 0 0 0 4 0" />
    </>
  ),
  acessibilidade: (
    <>
      <circle cx="12" cy="4.5" r="1.8" />
      <path d="M12 8v6h5l2 6" />
      <path d="M7.5 11.5a5.5 5.5 0 1 0 8 6" />
    </>
  ),
  wifi: (
    <>
      <path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" />
      <circle cx="12" cy="19" r="1" />
    </>
  ),
  aluguel_material: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m12 8 3.5 2.5-1.3 4.1H9.8L8.5 10.5Z" />
    </>
  ),
};

/** Decorative 24px line icon of an amenity; the label next to it names it. */
export function AmenityIcon({ amenity }: { amenity: Amenity }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      {PATHS[amenity]}
    </svg>
  );
}
