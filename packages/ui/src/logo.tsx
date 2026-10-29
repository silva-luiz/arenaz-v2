import type { ComponentProps } from 'react';

export interface LogoMarkProps extends Omit<ComponentProps<'svg'>, 'ref'> {
  size?: number;
}

/**
 * The ArenaZ logo glyph (rounded square with a pitch), straight from
 * docs/design/prototipo-v2.md. Decorative: the wordmark or the surrounding
 * link carries the name.
 */
export function LogoMark({ size = 34, ...props }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <rect width="34" height="34" rx="10" fill="#0B7A4B" />
      <rect
        x="7"
        y="10"
        width="20"
        height="14"
        rx="2"
        stroke="#FFFFFF"
        strokeWidth="1.8"
      />
      <line
        x1="17"
        y1="10"
        x2="17"
        y2="24"
        stroke="#FFFFFF"
        strokeWidth="1.8"
      />
      <circle cx="17" cy="17" r="3.2" stroke="#FFFFFF" strokeWidth="1.8" />
    </svg>
  );
}
