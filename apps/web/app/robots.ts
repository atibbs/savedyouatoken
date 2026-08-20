import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    // Shared reports use a page-level noindex directive. They must remain crawlable so search
    // engines can see that directive instead of reporting an indexed-but-blocked URL.
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
