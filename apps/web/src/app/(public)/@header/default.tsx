/**
 * `@header` slot of routes without their own: nothing (the header has its own content there). Every route of
 * `(public)` has a slot page, so a client-side navigation never keeps a venue
 * page's pill in the header.
 */
export default function HeaderSlotDefault() {
  return null;
}
