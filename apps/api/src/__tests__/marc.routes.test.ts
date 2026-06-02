import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { users, schools } from '../db/schema/index.js';
import { books, bookInventory } from '../db/schema/books.js';
import { signAccessToken } from '../lib/jwt.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal ISO 2709 binary MARC record for a book.
 * Encodes tags: 020 (ISBN), 100 (author), 245 (title), 260 (publisher/year), 520 (summary).
 */
function buildMarcRecord(fields: Record<string, string>): Buffer {
  const FT = '\x1e';
  const SD = '\x1f';
  const RT = '\x1d';

  // Build field data: each data field = 2 indicators + subfields
  const fieldData: Array<{ tag: string; data: string }> = [];

  if (fields.isbn) fieldData.push({ tag: '020', data: `  ${SD}a${fields.isbn}${FT}` });
  if (fields.author) fieldData.push({ tag: '100', data: `  ${SD}a${fields.author}${FT}` });
  if (fields.title) fieldData.push({ tag: '245', data: `  ${SD}a${fields.title}${FT}` });
  if (fields.publisher || fields.year) {
    fieldData.push({
      tag: '260',
      data: `  ${SD}b${fields.publisher ?? ''}${SD}c${fields.year ?? ''}${FT}`,
    });
  }
  if (fields.description) fieldData.push({ tag: '520', data: `  ${SD}a${fields.description}${FT}` });

  // Directory entries (12 bytes each: tag[3] + len[4] + pos[5])
  let pos = 0;
  let directory = '';
  let dataStr = '';

  for (const f of fieldData) {
    const len = f.data.length;
    directory += f.tag + String(len).padStart(4, '0') + String(pos).padStart(5, '0');
    dataStr += f.data;
    pos += len;
  }
  directory += FT; // directory terminator

  const baseAddr = 24 + directory.length;
  const totalLen = baseAddr + dataStr.length + 1; // +1 for RT

  // Build leader (24 bytes)
  const leader =
    String(totalLen).padStart(5, '0') + // 0-4: record length
    'n' + // 5: status
    'a' + // 6: type of record (language material)
    'm' + // 7: bibliographic level (monograph)
    ' ' + // 8: type of control
    'a' + // 9: encoding (UTF-8)
    '22' + // 10-11: indicator count + subfield code count
    String(baseAddr).padStart(5, '0') + // 12-16: base address
    '   ' + // 17-19: encoding level etc.
    '4500'; // 20-23: map to entry

  const recordStr = leader + directory + dataStr + RT;
  return Buffer.from(recordStr, 'utf8');
}

/** Concatenate multiple MARC records into a single .mrc file buffer. */
function buildMarcFile(...records: Buffer[]): Buffer {
  return Buffer.concat(records);
}

/** Build a MARCXML string from a list of books. */
function buildMarcXml(
  bookList: Array<{
    isbn?: string;
    title: string;
    author?: string;
    publisher?: string;
    year?: string;
    description?: string;
  }>,
): string {
  const sf = (code: string, value: string) =>
    `<subfield code="${code}">${value}</subfield>`;
  const df = (tag: string, content: string) =>
    `<datafield tag="${tag}" ind1=" " ind2=" ">${content}</datafield>`;

  const records = bookList
    .map((b) => {
      const fields = [
        b.isbn ? df('020', sf('a', b.isbn)) : '',
        b.author ? df('100', sf('a', b.author)) : '',
        df('245', sf('a', b.title)),
        b.publisher || b.year ? df('260', `${b.publisher ? sf('b', b.publisher) : ''}${b.year ? sf('c', b.year) : ''}`) : '',
        b.description ? df('520', sf('a', b.description)) : '',
      ]
        .filter(Boolean)
        .join('\n');
      return `<record>\n<leader>00000nam a2200000 a 4500</leader>\n${fields}\n</record>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<collection xmlns="http://www.loc.gov/MARC21/slim">\n${records}\n</collection>`;
}

// ─── Test Setup ───────────────────────────────────────────────────────────────

let schoolId: string;
let librarianToken: string;
let studentToken: string;
const createdUserIds: string[] = [];
const createdBookIsbns: string[] = [];

beforeAll(async () => {
  const [school] = await db
    .insert(schools)
    .values({ name: `MARC Test School ${Date.now()}` })
    .returning({ id: schools.id });
  schoolId = school!.id;

  const makeUser = async (role: 'librarian' | 'student') => {
    const [u] = await db
      .insert(users)
      .values({
        email: `marc-${role}-${Date.now()}@test.com`,
        passwordHash: 'hash',
        fullName: `MARC ${role}`,
        role,
        schoolId,
        isActive: true,
        emailVerified: true,
        approvalStatus: 'approved',
      })
      .returning({ id: users.id });
    createdUserIds.push(u!.id);
    return u!.id;
  };

  const librarianId = await makeUser('librarian');
  const studentId = await makeUser('student');

  librarianToken = signAccessToken({ sub: librarianId, role: 'librarian', schoolId });
  studentToken = signAccessToken({ sub: studentId, role: 'student', schoolId });
});

afterAll(async () => {
  if (createdBookIsbns.length > 0) {
    const booksToDelete = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.schoolId, schoolId));
    const bookIds = booksToDelete.map((b) => b.id);
    if (bookIds.length > 0) {
      await db.delete(bookInventory).where(eq(bookInventory.schoolId, schoolId));
      for (const id of bookIds) await db.delete(books).where(eq(books.id, id));
    }
  }
  if (createdUserIds.length > 0) {
    for (const id of createdUserIds) await db.delete(users).where(eq(users.id, id));
  }
  await db.delete(schools).where(eq(schools.id, schoolId));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/books/import/marc', () => {
  it('returns 401 without auth token', async () => {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('<collection/>')], { type: 'application/xml' }), 'test.xml');
    const res = await app.request('/api/v1/books/import/marc', { method: 'POST', body: form });
    expect(res.status).toBe(401);
  });

  it('returns 403 for student role', async () => {
    const form = new FormData();
    form.append('file', new Blob([Buffer.from('<collection/>')], { type: 'application/xml' }), 'test.xml');
    const res = await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: form,
    });
    expect(res.status).toBe(403);
  });

  it('returns 422 when no file field is provided', async () => {
    const form = new FormData();
    const res = await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });
    expect(res.status).toBe(422);
    const json = (await res.json()) as { success: boolean; code: string };
    expect(json.success).toBe(false);
    expect(json.code).toBe('MISSING_FILE');
  });

  it('imports books from MARCXML and returns result', async () => {
    const isbn = `978${Date.now().toString().slice(-10)}`;
    createdBookIsbns.push(isbn);

    const xml = buildMarcXml([
      { isbn, title: 'Test MARC Book', author: 'Test Author', publisher: 'Test Press', year: '2024' },
    ]);

    const form = new FormData();
    form.append('file', new Blob([xml], { type: 'application/xml' }), 'catalog.xml');

    const res = await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { booksImported: number; copiesCreated: number; errors: unknown[] } };
    expect(json.success).toBe(true);
    expect(json.data.booksImported).toBe(1);
    expect(json.data.copiesCreated).toBe(1);
    expect(json.data.errors).toHaveLength(0);
  });

  it('updates existing book on re-import with same ISBN (MARCXML)', async () => {
    const isbn = `978${Date.now().toString().slice(-10)}`;
    createdBookIsbns.push(isbn);

    const xml1 = buildMarcXml([{ isbn, title: 'Original Title', author: 'Author One' }]);
    const form1 = new FormData();
    form1.append('file', new Blob([xml1], { type: 'application/xml' }), 'catalog.xml');
    await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form1,
    });

    const xml2 = buildMarcXml([{ isbn, title: 'Updated Title', author: 'Author One' }]);
    const form2 = new FormData();
    form2.append('file', new Blob([xml2], { type: 'application/xml' }), 'catalog.xml');
    const res2 = await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form2,
    });

    const json = (await res2.json()) as { data: { booksImported: number; booksUpdated: number } };
    expect(json.data.booksImported).toBe(0);
    expect(json.data.booksUpdated).toBe(1);
  });

  it('imports books from binary MARC (.mrc) format', async () => {
    const isbn = `978${Date.now().toString().slice(-10)}`;
    createdBookIsbns.push(isbn);

    const mrc = buildMarcFile(
      buildMarcRecord({
        isbn,
        title: 'Binary MARC Book',
        author: 'Binary Author',
        publisher: 'Binary Press',
        year: '2023',
      }),
    );

    const form = new FormData();
    form.append('file', new Blob([mrc], { type: 'application/octet-stream' }), 'catalog.mrc');

    const res = await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { booksImported: number } };
    expect(json.success).toBe(true);
    expect(json.data.booksImported).toBe(1);
  });

  it('imports multiple records from a single MARCXML file', async () => {
    const isbn1 = `978${Date.now().toString().slice(-10)}`;
    const isbn2 = `978${(Date.now() + 1).toString().slice(-10)}`;
    createdBookIsbns.push(isbn1, isbn2);

    const xml = buildMarcXml([
      { isbn: isbn1, title: 'Multi Book One', author: 'Author A' },
      { isbn: isbn2, title: 'Multi Book Two', author: 'Author B' },
    ]);

    const form = new FormData();
    form.append('file', new Blob([xml], { type: 'application/xml' }), 'catalog.xml');

    const res = await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });

    const json = (await res.json()) as { data: { booksImported: number; copiesCreated: number } };
    expect(json.data.booksImported).toBe(2);
    expect(json.data.copiesCreated).toBe(2);
  });

  it('creates book inventory copy for each new MARC import', async () => {
    const isbn = `978${Date.now().toString().slice(-10)}`;
    createdBookIsbns.push(isbn);

    const xml = buildMarcXml([{ isbn, title: 'Copy Test Book', author: 'Copy Author' }]);
    const form = new FormData();
    form.append('file', new Blob([xml], { type: 'application/xml' }), 'catalog.xml');

    await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });

    const [book] = await db
      .select({ id: books.id })
      .from(books)
      .where(and(eq(books.isbn, isbn), eq(books.schoolId, schoolId)))
      .limit(1);

    const copies = await db
      .select()
      .from(bookInventory)
      .where(eq(bookInventory.bookId, book!.id));

    expect(copies.length).toBe(1);
    expect(copies[0]!.status).toBe('available');
  });

  it('returns 422 on empty file upload', async () => {
    const form = new FormData();
    form.append('file', new Blob([], { type: 'application/xml' }), 'empty.xml');

    const res = await app.request('/api/v1/books/import/marc', {
      method: 'POST',
      headers: { Authorization: `Bearer ${librarianToken}` },
      body: form,
    });

    expect(res.status).toBe(422);
    const json = (await res.json()) as { code: string };
    expect(json.code).toBe('EMPTY_FILE');
  });
});
