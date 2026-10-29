/** Current ArenaZ logo: field mark + "arenaz" wordmark (docs/design/prototipo-v2.md). */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        aria-hidden="true"
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
      <span className="font-wordmark text-[26px] leading-none font-extrabold tracking-[-0.045em]">
        arenaz
      </span>
    </span>
  );
}
