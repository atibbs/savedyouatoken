/**
 * Free-tier limits.
 *
 * Kept in a plain module rather than beside the component that enforces them: a value
 * exported from a `'use client'` file becomes a client reference when a server component
 * imports it, and renders as a function stub instead of the number.
 */
export const FREE_SAVED_LIMIT = 3;
