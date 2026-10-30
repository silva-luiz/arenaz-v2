/** "01310100" → "01310-100"; anything else is left as typed. */
export function formatCep(value: string): string {
  return /^\d{8}$/.test(value)
    ? `${value.slice(0, 5)}-${value.slice(5)}`
    : value;
}

/** "+5511987654321" → "(11) 98765-4321"; unknown shapes are left as they are. */
export function formatPhoneBr(e164: string): string {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return match
    ? `(${match[1] ?? ''}) ${match[2] ?? ''}-${match[3] ?? ''}`
    : e164;
}

/** Minutes since midnight as "HH:MM"; 1440 is "24:00". */
export function formatMinute(minute: number): string {
  const hours = String(Math.floor(minute / 60)).padStart(2, '0');
  const minutes = String(minute % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}
