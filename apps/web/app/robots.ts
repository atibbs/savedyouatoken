import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Shared reports are per-user payloads in a URL fragment; there is nothing there to index.
      disallow: '/r',
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
