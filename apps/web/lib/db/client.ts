import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/*
  Lazy, optional database connection.

  postgres.js does not open a socket until the first query is issued, so constructing the
  client at module load is safe and never runs during the static build. When DATABASE_URL
  is absent the app runs perfectly well with no database — the free tier needs none, and
  the Pro API routes report "not configured" rather than crashing.
*/

const url = process.env.DATABASE_URL;

/** Whether a database is configured. Pro server features are gated on this. */
export const dbConfigured = Boolean(url);

// `prepare: false` is required for transaction-pooled connections (Neon/Supabase poolers),
// which is the free-tier deployment target.
const client = url ? postgres(url, { prepare: false }) : null;

export const db = client ? drizzle(client, { schema }) : null;
