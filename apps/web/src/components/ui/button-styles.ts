const BASE =
  'inline-flex h-12 items-center justify-center rounded-[14px] px-5 text-base font-semibold transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60';

/** Brand call to action. */
export const primaryButton = `${BASE} bg-brand text-white hover:bg-brand/90`;

/** Bordered, for secondary actions. */
export const secondaryButton = `${BASE} border border-line-strong bg-bg text-ink hover:bg-surface`;
