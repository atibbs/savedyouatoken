import type { Config } from 'drizzle-kit';

// Used by `drizzle-kit` to generate and apply migrations against DATABASE_URL.
// Not imported by the app at runtime.
export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
} satisfies Config;
