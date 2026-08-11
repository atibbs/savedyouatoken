import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db, dbConfigured } from '@/lib/db/client';
import { savedPrompts } from '@/lib/db/schema';

/** Delete one of the signed-in user's saved prompts. Ownership is enforced in the query. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!dbConfigured || !db) return NextResponse.json({ error: 'storage_not_configured' }, { status: 501 });

  const { id } = await params;
  const deleted = await db
    .delete(savedPrompts)
    .where(and(eq(savedPrompts.id, id), eq(savedPrompts.userId, userId)))
    .returning({ id: savedPrompts.id });

  if (deleted.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
