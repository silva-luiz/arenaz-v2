/** Pulsing green dot of the "ao vivo" lines; still under reduced motion. */
export function LiveDot() {
  return (
    <span
      aria-hidden="true"
      className="size-2 shrink-0 animate-live rounded-full bg-live motion-reduce:animate-none"
    />
  );
}
