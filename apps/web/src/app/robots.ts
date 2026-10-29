import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

/** Everything is open to crawlers except the panel, the account and the API. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/painel', '/conta', '/entrar', '/cadastro', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
