import Stripe from 'stripe';

/*
  Stripe boundary. Like the database, it is optional: with no STRIPE_SECRET_KEY the client
  is null, `stripeConfigured` is false, and the pricing page shows "checkout not connected"
  rather than offering a broken button. Nothing here charges anyone until the keys are set.
*/

const secret = process.env.STRIPE_SECRET_KEY;

export const stripeConfigured = Boolean(secret && process.env.STRIPE_PRICE_PRO_MONTHLY);

// Constructing the SDK does not open any connection, so this is safe at module load.
export const stripe = secret ? new Stripe(secret) : null;

export const PRO_PRICE_ID = process.env.STRIPE_PRICE_PRO_MONTHLY ?? '';

/** Statuses Stripe considers a live, paid-for subscription. */
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  'active',
  'trialing',
]);
