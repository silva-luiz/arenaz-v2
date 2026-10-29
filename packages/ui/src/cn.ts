type ClassValue = string | false | null | undefined;

/** Joins class names, dropping falsy entries. No dependencies on purpose. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ');
}
