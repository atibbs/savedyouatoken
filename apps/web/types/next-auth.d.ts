import 'next-auth';

// The session callback copies the JWT subject onto the user, so `session.user.id` is the
// stable per-user key used for saved prompts and entitlements.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
