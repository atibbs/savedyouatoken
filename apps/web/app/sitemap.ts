import type { MetadataRoute } from 'next';
import { ALL_RULES, MODELS } from '@savedyouatoken/core';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages = ['', '/waste', '/models', '/cli', '/kit', '/pricing', '/methodology'].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === '' ? 1 : 0.8,
  }));

  const rulePages = ALL_RULES.map((rule) => ({
    url: `${SITE_URL}/waste/${rule.id}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const modelPages = MODELS.map((model) => ({
    url: `${SITE_URL}/models/${model.id}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: model.legacy ? 0.3 : 0.6,
  }));

  return [...staticPages, ...rulePages, ...modelPages];
}
