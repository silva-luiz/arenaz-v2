'use client';

import { useId, useRef, useState } from 'react';
import { cn } from './cn';
import { FOCUS_RING } from './link';
import { Lightbox, type LightboxPhoto } from './lightbox';

export type GalleryPhoto = LightboxPhoto;

export interface GalleryProps {
  photos: GalleryPhoto[];
  className?: string | undefined;
}

/** Photos on the grid (the rest only in the lightbox, "Mostrar todas"). */
const GRID_PHOTOS = 5;

/*
 * Desktop layout per visible photo count (Quadra.dc.html). 3+ photos use 4
 * columns x 2 rows of 210px: a 2x2 main photo and the rest on the right.
 * 1 and 2 photos fill one row of 428px (the same height).
 */
function gridClasses(visible: number): string {
  if (visible <= 1) return 'md:grid-cols-1 md:grid-rows-[428px]';
  if (visible === 2) return 'md:grid-cols-2 md:grid-rows-[428px]';
  return 'md:grid-cols-4 md:grid-rows-[210px_210px]';
}

/**
 * Where a photo sits. Phone (2 columns, as the prototype below 760px): the
 * first photo takes the row at 4:3, the others are squares; when an odd
 * number of squares would leave a hole, the last one takes the row at 2:1.
 * Desktop: see `gridClasses`.
 */
function photoClasses(position: number, visible: number): string {
  if (position === 0) {
    return cn(
      'col-span-2 aspect-[4/3] md:aspect-auto',
      visible >= 3 ? 'md:row-span-2' : 'md:col-span-1',
    );
  }
  const lastOfOddRow = position === visible - 1 && (visible - 1) % 2 === 1;
  const phone = lastOfOddRow ? 'col-span-2 aspect-[2/1]' : 'aspect-square';
  // With exactly 3 photos the two small ones stack on the right at full
  // width; with 4 the first small one spans the top and two share the bottom.
  const desktop =
    visible === 3 || (visible === 4 && position === 1)
      ? 'md:col-span-2'
      : 'md:col-span-1';
  return cn(phone, 'md:aspect-auto', desktop);
}

/*
 * `sizes` of each photo, from the venue page's 1160px column (16px gutters on
 * a phone, 40px from md, as in SiteHeader) and the grids above (8px gaps).
 */
const FULL =
  '(min-width: 1240px) 1160px, (min-width: 768px) calc(100vw - 80px)';
const HALF = '(min-width: 1240px) 576px, (min-width: 768px) calc(50vw - 44px)';
const QUARTER =
  '(min-width: 1240px) 284px, (min-width: 768px) calc(25vw - 26px)';
const PHONE_FULL = 'calc(100vw - 32px)';
const PHONE_HALF = 'calc(50vw - 20px)';

function photoSizes(position: number, visible: number): string {
  // Same spans as gridClasses/photoClasses.
  let desktop = QUARTER;
  if (visible <= 1) desktop = FULL;
  else if (
    visible <= 3 ||
    position === 0 ||
    (visible === 4 && position === 1)
  ) {
    desktop = HALF;
  }
  const wideOnPhone =
    position === 0 || (position === visible - 1 && (visible - 1) % 2 === 1);
  return `${desktop}, ${wideOnPhone ? PHONE_FULL : PHONE_HALF}`;
}

/**
 * Photo grid of a venue page (Quadra.dc.html): one large photo plus up to
 * four small ones, in 4 columns on desktop and 2 on a phone, rounded as a
 * whole, with "Mostrar todas as fotos" over it. Fewer photos fill the grid
 * without holes. Each photo opens the `Lightbox` at its index; the lightbox
 * has every photo, the grid only the first five.
 */
export function Gallery({ photos, className }: GalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  // The element that opened the lightbox, so focus can go back to it even
  // when the click did not focus it (Safari, Firefox on macOS).
  const triggerRef = useRef<HTMLElement | null>(null);
  const baseId = useId();
  const total = photos.length;
  if (total === 0) return null;

  const visible = Math.min(total, GRID_PHOTOS);

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'grid grid-cols-2 gap-2 overflow-hidden rounded-photo shadow-2 md:rounded-card',
          gridClasses(visible),
        )}
      >
        {photos.slice(0, visible).map((photo, position) => {
          const descriptionId = `${baseId}-${String(position)}`;
          return (
            <button
              key={`${photo.url}-${String(position)}`}
              type="button"
              aria-label={`Abrir foto ${String(position + 1)} de ${String(total)}`}
              aria-describedby={descriptionId}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setOpenIndex(position);
              }}
              className={cn(
                'group relative overflow-hidden bg-surface',
                'focus-visible:outline-hidden',
                photoClasses(position, visible),
              )}
            >
              <img
                src={photo.url}
                {...(photo.srcSet
                  ? {
                      srcSet: photo.srcSet,
                      sizes: photoSizes(position, visible),
                    }
                  : {})}
                alt=""
                {...(position === 0 ? {} : { loading: 'lazy' as const })}
                decoding="async"
                draggable={false}
                className="absolute inset-0 size-full object-cover transition-[transform,filter] duration-500 ease-out group-hover:scale-[1.04] group-hover:brightness-90 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span id={descriptionId} className="sr-only">
                {photo.alt}
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 group-focus-visible:shadow-[inset_0_0_0_3px_var(--color-ink),inset_0_0_0_6px_var(--color-bg)]"
              />
            </button>
          );
        })}
      </div>

      {total >= 2 ? (
        <button
          type="button"
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setOpenIndex(0);
          }}
          className={cn(
            'absolute right-4 bottom-4 inline-flex h-11 items-center gap-2 rounded-[10px] border border-ink bg-bg px-3.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none md:h-[38px]',
            FOCUS_RING,
          )}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="5" height="5" rx="1" />
            <rect x="10" y="3" width="5" height="5" rx="1" />
            <rect x="17" y="3" width="4" height="5" rx="1" />
            <rect x="3" y="10" width="5" height="5" rx="1" />
            <rect x="10" y="10" width="5" height="5" rx="1" />
            <rect x="17" y="10" width="4" height="5" rx="1" />
          </svg>
          Mostrar todas as fotos
        </button>
      ) : null}

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          returnFocusRef={triggerRef}
          onClose={() => {
            setOpenIndex(null);
          }}
        />
      ) : null}
    </div>
  );
}
