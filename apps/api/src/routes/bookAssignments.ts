import { Hono } from 'hono';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { sectionBookAssignments, books } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const bookAssignmentsRouter = new Hono();

const staffOnly = [requireAuth, requireRole('admin', 'librarian', 'teacher')] as const;

const AssignSchema = z.object({
  bookId: z.string().uuid(),
  type: z.enum(['required', 'optional']).default('optional'),
  note: z.string().max(500).optional(),
});

/** GET /api/v1/class-sections/:sectionId/books */
bookAssignmentsRouter.get('/:sectionId/books', ...staffOnly, async (c) => {
  const sectionId = c.req.param('sectionId') ?? '';
  if (!sectionId) return c.json({ success: false, error: 'Missing sectionId', code: 'MISSING_PARAM' }, 400);
  try {
    const rows = await db
      .select({
        bookId: sectionBookAssignments.bookId,
        type: sectionBookAssignments.type,
        note: sectionBookAssignments.note,
        assignedAt: sectionBookAssignments.assignedAt,
        title: books.title,
        author: books.author,
        coverUrl: books.coverUrl,
      })
      .from(sectionBookAssignments)
      .innerJoin(books, eq(books.id, sectionBookAssignments.bookId))
      .where(eq(sectionBookAssignments.sectionId, sectionId));
    return c.json({ success: true, data: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'LIST_FAILED' }, 500);
  }
});

/** POST /api/v1/class-sections/:sectionId/books */
bookAssignmentsRouter.post('/:sectionId/books', ...staffOnly, async (c) => {
  const sectionId = c.req.param('sectionId') ?? '';
  if (!sectionId) return c.json({ success: false, error: 'Missing sectionId', code: 'MISSING_PARAM' }, 400);
  const user = c.get('user') as { sub: string };
  const body: unknown = await c.req.json();
  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.message, code: 'VALIDATION_ERROR' }, 422);
  try {
    await db.insert(sectionBookAssignments).values({
      sectionId,
      bookId: parsed.data.bookId,
      type: parsed.data.type,
      note: parsed.data.note,
      assignedBy: user.sub,
    }).onConflictDoUpdate({
      target: [sectionBookAssignments.sectionId, sectionBookAssignments.bookId],
      set: { type: parsed.data.type, note: parsed.data.note },
    });
    return c.json({ success: true, data: null }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'ASSIGN_FAILED' }, 500);
  }
});

/** DELETE /api/v1/class-sections/:sectionId/books/:bookId */
bookAssignmentsRouter.delete('/:sectionId/books/:bookId', ...staffOnly, async (c) => {
  const sectionId = c.req.param('sectionId') ?? '';
  const bookId = c.req.param('bookId') ?? '';
  if (!sectionId || !bookId) return c.json({ success: false, error: 'Missing param', code: 'MISSING_PARAM' }, 400);
  try {
    await db.delete(sectionBookAssignments).where(
      and(eq(sectionBookAssignments.sectionId, sectionId), eq(sectionBookAssignments.bookId, bookId))
    );
    return c.json({ success: true, data: null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'REMOVE_FAILED' }, 500);
  }
});

/** GET /api/v1/my/assigned-books — student sees books assigned to their sections */
bookAssignmentsRouter.get('/my/assigned-books', requireAuth, async (c) => {
  const user = c.get('user') as { sub: string };
  try {
    const rows = await db.execute<{ book_id: string; title: string; author: string; cover_url: string | null; type: string; note: string | null; section_name: string }>(
      `SELECT sba.book_id, b.title, b.author, b.cover_url, sba.type, sba.note, cs.name as section_name
       FROM section_book_assignments sba
       JOIN books b ON b.id = sba.book_id
       JOIN class_sections cs ON cs.id = sba.section_id
       JOIN class_section_students css ON css.section_id = sba.section_id
       WHERE css.user_id = $1`,
      [user.sub]
    );
    return c.json({ success: true, data: rows });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ success: false, error: msg, code: 'FETCH_FAILED' }, 500);
  }
});
