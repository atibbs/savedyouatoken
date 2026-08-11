import NextAuth, { type NextAuthConfig } from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Credentials from 'next-auth/providers/credentials';

/*
  Authentication boundary.

  - JWT sessions, so auth itself needs no database. The database is only for Pro data.
  - GitHub is the production provider (the audience already has a GitHub account). It is
    added only when its credentials are present, so the app runs with none configured.
  - A dev-only credentials provider lets signed-in flows be exercised locally without any
    OAuth setup. It is refused in production and unless ALLOW_DEV_LOGIN is explicitly set.
*/

const isProd = process.env.NODE_ENV === 'production';
const allowDevLogin = process.env.ALLOW_DEV_LOGIN === 'true' && !isProd;

const providers: NextAuthConfig['providers'] = [];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  // v5 reads AUTH_GITHUB_ID / AUTH_GITHUB_SECRET from the environment automatically.
  providers.push(GitHub);
}

if (allowDevLogin) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Dev login (local only)',
      credentials: { email: { label: 'Email', type: 'email' } },
      authorize: (creds) => {
        const email = typeof creds?.email === 'string' && creds.email ? creds.email : 'dev@example.com';
        return { id: `dev:${email}`, email, name: email.split('@')[0] };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  // AUTH_SECRET is required in production; a clearly-fake fallback keeps local dev running.
  secret: process.env.AUTH_SECRET ?? (isProd ? undefined : 'dev-insecure-secret-not-for-production'),
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
