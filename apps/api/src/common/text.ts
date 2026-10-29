/** An empty or blank optional text becomes NULL, so "no text" is stored one way. */
export function textOrNull(value: string | null | undefined): string | null {
  return value === undefined || value === null || value.trim() === ''
    ? null
    : value;
}
