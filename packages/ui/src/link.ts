import type { ComponentProps, ElementType } from 'react';

/**
 * Links in `@arenaz/ui` stay framework-agnostic: every component that renders
 * navigation accepts an optional `linkComponent` and falls back to a plain
 * `<a>`. The app decides what a link is. With Next, pass a thin wrapper
 * around `next/link` (typedRoutes types `href` as a route, so the wrapper is
 * where the `string` -> route cast lives):
 *
 *     const AppLink: LinkComponent = ({ href, ...rest }) => (
 *       <NextLink href={href as Route} {...rest} />
 *     );
 *
 * Whatever is passed must render an anchor-like element, forward `className`
 * and the ARIA props, and accept `children`.
 */
export type LinkProps = Omit<ComponentProps<'a'>, 'ref'> & { href: string };
export type LinkComponent = ElementType<LinkProps>;

/** Keyboard focus ring shared by every interactive element. */
export const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand';
