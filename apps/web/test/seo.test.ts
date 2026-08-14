import { describe, expect, it } from 'vitest';
import { MODELS, PRICES_VERIFIED_ON } from '@savedyouatoken/core';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { SITE_URL } from '@/lib/site';

describe('search discovery', () => {
  it('publishes unique canonical URLs without private report routes', () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toContain(`${SITE_URL}/sdk`);
    expect(urls.some((url) => url === `${SITE_URL}/r` || url.startsWith(`${SITE_URL}/r/`))).toBe(false);
  });

  it('uses the verified pricing date only where that date is truthful', () => {
    const entries = sitemap();
    const modelUrls = new Set([
      `${SITE_URL}/models`,
      ...MODELS.map((model) => `${SITE_URL}/models/${model.id}`),
    ]);

    for (const entry of entries) {
      if (modelUrls.has(entry.url)) expect(entry.lastModified).toBe(PRICES_VERIFIED_ON);
      else expect(entry.lastModified).toBeUndefined();
    }
  });

  it('lets crawlers read page-level noindex directives', () => {
    const config = robots();

    expect(config.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    expect(config.host).toBe(SITE_URL);
    expect(config.rules).toMatchObject({ userAgent: '*', allow: '/' });
    expect(config.rules).not.toHaveProperty('disallow');
  });
});
