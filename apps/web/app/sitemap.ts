import type { MetadataRoute } from 'next';
import { ALL_RULES, MODELS, PRICES_VERIFIED_ON } from '@savedyouatoken/core';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ['', '/waste', '/models', '/sdk', '/cli', '/kit', '/pricing', '/methodology'].map((path) => ({
    url: `${SITE_URL}${path}`,
    // Only publish a date when the underlying content has a reliable source date. A build
    // timestamp falsely tells crawlers that every page changed on every deployment.
    ...(path === '/models' ? { lastModified: PRICES_VERIFIED_ON } : {}),
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  const rulePages = ALL_RULES.map((rule) => ({
    url: `${SITE_URL}/waste/${rule.id}`,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const modelPages = MODELS.map((model) => ({
    url: `${SITE_URL}/models/${model.id}`,
    lastModified: PRICES_VERIFIED_ON,
    changeFrequency: 'weekly' as const,
    priority: model.legacy ? 0.3 : 0.6,
  }));

  return [...staticPages, ...rulePages, ...modelPages];
}
