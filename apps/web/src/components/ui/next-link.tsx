import type { LinkComponent } from '@arenaz/ui';
import type { Route } from 'next';
import NextLink from 'next/link';

/**
 * The `linkComponent` for every `@arenaz/ui` piece that renders navigation.
 * `@arenaz/ui` types `href` as a plain string; with `typedRoutes` Next wants a
 * `Route`, so the cast lives here, in one place.
 */
export const AppLink: LinkComponent = ({ href, ...rest }) => (
  <NextLink href={href as Route} {...rest} />
);
