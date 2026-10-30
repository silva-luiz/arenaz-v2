/**
 * `@header` slot of /buscar: nothing (the header reads the search from the URL itself). Every route of
 * `(public)` has a slot page, so a client-side navigation never keeps a venue
 * page's pill in the header.
 */
export default function SearchHeaderSlot() {
  return null;
}
