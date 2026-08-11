import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, dbConfigured } from '@/lib/db/client';
import { savedPrompts } from '@/lib/db/schema';
import { isPro } from '@/lib/entitlements';

const MAX_PROMPT_CHARS = 200_000;

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function int(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** List the signed-in user's saved prompts, newest first. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!dbConfigured || !db) return NextResponse.json({ error: 'storage_not_configured' }, { status: 501 });

  const rows = await db
    .select()
    .from(savedPrompts)
    .where(eq(savedPrompts.userId, userId))
    .orderBy(desc(savedPrompts.updatedAt));

  return NextResponse.json({ prompts: rows });
}

/** Save a prompt to the account. Pro-only — the free tier saves 3 prompts client-side. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!dbConfigured || !db) return NextResponse.json({ error: 'storage_not_configured' }, { status: 501 });
  if (!(await isPro(userId))) return NextResponse.json({ error: 'pro_required' }, { status: 402 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const prompt = str(b.prompt);
  if (!prompt.trim()) return NextResponse.json({ error: 'prompt_required' }, { status: 400 });
  if (prompt.length > MAX_PROMPT_CHARS) return NextResponse.json({ error: 'prompt_too_large' }, { status: 413 });

  const now = new Date();
  const row = {
    id: randomUUID(),
    userId,
    title: str(b.title, 'Untitled prompt').slice(0, 200),
    prompt,
    tools: str(b.tools),
    modelId: str(b.modelId, 'claude-sonnet-5'),
    requestsPerDay: int(b.requestsPerDay),
    outputTokens: int(b.outputTokens),
    savedTokens: int(b.savedTokens),
    createdAt: now,
    updatedAt: now,
  };

  await db.insert(savedPrompts).values(row);
  return NextResponse.json({ prompt: row }, { status: 201 });
}
