'use client';

import { useId, useState } from 'react';
import { cn } from './cn';
import { FOCUS_RING } from './link';
import { Lightbox, type LightboxPhoto } from './lightbox';

export type GalleryPhoto = LightboxPhoto;

export interface GalleryProps {
  photos: GalleryPhoto[];
  className?: string | undefined;
}

/** Desktop grid shown for 1..5 photos (the rest only live on the strip). */
const GRID_PHOTOS = 5;

/*
 * Desktop layout per visible photo count. 3+ photos use 4 columns x 2 rows of
 * 210px: a 2x2 main photo and the rest on the right. 1 and 2 photos fill one
 * row of 428px (the same height).
 */
function gridClasses(visible: number): string {
  if (visible <= 1) return 'md:grid-cols-1 md:grid-rows-[428px]';
  if (visible === 2) return 'md:grid-cols-2 md:grid-rows-[428px]';
  return 'md:grid-cols-4 md:grid-rows-[210px_210px]';
}

function photoClasses(position: number, visible: number): string {
  if (position >= GRID_PHOTOS) return 'md:hidden';
  if (position === 0 && visible >= 3) return 'md:col-span-2 md:row-span-2';
  // With exactly 3 photos the two small ones stack on the right at full
  // width; with 4 the first small one spans the top and two share the bottom.
  if (visible === 3) return 'md:col-span-2';
  if (visible === 4 && position === 1) return 'md:col-span-2';
  return '';
}

/**
 * Photo grid of a venue page: one large photo plus up to four small ones on
 * desktop (20px radius on the whole), a swipeable scroll-snap row with every
 * photo on mobile. Each photo opens the `Lightbox` at its index.
 */
export function Gallery({ photos, className }: GalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();
  const total = photos.length;
  if (total === 0) return null;

  const visible = Math.min(total, GRID_PHOTOS);

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex snap-x snap-mandatory gap-2 overflow-x-auto md:grid md:snap-none md:overflow-hidden md:rounded-photo md:shadow-2',
          gridClasses(visible),
        )}
      >
        {photos.map((photo, position) => {
          const descriptionId = `${baseId}-${String(position)}`;
          return (
            <button
              key={`${photo.url}-${String(position)}`}
              type="button"
              aria-label={`Abrir foto ${String(position + 1)} de ${String(total)}`}
              aria-describedby={descriptionId}
              onClick={() => {
                setOpenIndex(position);
              }}
              className={cn(
                'group relative aspect-[4/3] basis-[88%] shrink-0 snap-center overflow-hidden rounded-photo bg-surface md:aspect-auto md:basis-auto md:rounded-none',
                'focus-visible:outline-hidden',
                photoClasses(position, visible),
              )}
            >
              <img
                src={photo.url}
                alt=""
                {...(position === 0 ? {} : { loading: 'lazy' as const })}
                decoding="async"
                draggable={false}
                className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
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
          onClick={() => {
            setOpenIndex(0);
          }}
          className={cn(
            'absolute right-4 bottom-4 inline-flex h-10 items-center gap-2 rounded-button border border-ink bg-bg px-3.5 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface motion-reduce:transition-none',
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
            <rect x="3" y="3" width="8" height="8" rx="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" />
          </svg>
          Mostrar todas as fotos
        </button>
      ) : null}

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          onClose={() => {
            setOpenIndex(null);
          }}
        />
      ) : null}
    </div>
  );
}
