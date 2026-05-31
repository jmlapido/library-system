import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../utils/errors.js';

// --- Mock the pdf generation module so no real PDFKit or bwip-js is invoked ---
vi.mock('../services/printing/pdf.js', () => ({
  generateSpineLabelPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
  generateCoverLabelPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
  generateMetadataCardPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
  generateBulkLabelPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}));

// --- Mock db (using vi.hoisted to avoid hoisting TDZ error) ---
const mockDb = vi.hoisted(() => ({
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
}));

vi.mock('../db/index.js', () => ({ db: mockDb }));

import { getCopyByBarcode, getSpineLabelPdf } from '../services/printing/index.js';

const SCHOOL_ID = 'school-uuid-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.select.mockReturnThis();
  mockDb.from.mockReturnThis();
  mockDb.innerJoin.mockReturnThis();
  mockDb.where.mockReturnThis();
  mockDb.limit.mockResolvedValue([]);
});

describe('getCopyByBarcode', () => {
  it('returns { copy, book } when db returns a joined row', async () => {
    const fakeRow = {
      book_inventory: {
        id: 'inv-1',
        barcode: 'SCAN123',
        status: 'available',
        bookId: 'book-1',
        copyNumber: 1,
        condition: 'good',
        location: 'Shelf A1',
        schoolId: SCHOOL_ID,
        acquisitionDate: null,
        purchaseCost: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      books: {
        id: 'book-1',
        title: 'Test Book',
        author: 'Test Author',
        isbn: '9781234567890',
        deweyDecimal: '823.914',
        publisher: 'Test Pub',
        publicationYear: 2020,
        schoolId: SCHOOL_ID,
        description: null,
        coverUrl: null,
        category: null,
        genre: null,
        subjectTags: null,
        language: 'en',
        pageCount: null,
        lexileLevel: null,
        readingLevel: null,
        seriesName: null,
        seriesNumber: null,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    mockDb.limit.mockResolvedValue([fakeRow]);

    const result = await getCopyByBarcode('SCAN123', SCHOOL_ID);

    expect(result.copy).toEqual(fakeRow.book_inventory);
    expect(result.book).toEqual(fakeRow.books);
  });

  it('throws AppError NOT_FOUND when db returns empty array', async () => {
    mockDb.limit.mockResolvedValue([]);

    await expect(getCopyByBarcode('NOTFOUND', SCHOOL_ID)).rejects.toMatchObject({
      name: 'AppError',
      code: 'NOT_FOUND',
    });
  });
});

describe('getSpineLabelPdf', () => {
  it('returns a Buffer starting with %PDF when copy exists', async () => {
    const copyRow = {
      copyId: 'copy-uuid',
      barcode: 'BAR001',
      copyNumber: 1,
      condition: 'good',
      location: 'Shelf B2',
      bookTitle: 'A Great Book',
      bookAuthor: 'Great Author',
      isbn: '9780000000001',
      deweyDecimal: '100.1',
      publisher: 'Publisher Co',
      publicationYear: 2021,
      schoolId: SCHOOL_ID,
    };

    const schoolRow = { name: 'Test School' };

    // First call: inventory + books join
    mockDb.limit.mockResolvedValueOnce([copyRow]);
    // Second call: schools lookup
    mockDb.limit.mockResolvedValueOnce([schoolRow]);

    const result = await getSpineLabelPdf('copy-uuid', SCHOOL_ID);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.toString().startsWith('%PDF')).toBe(true);
  });
});
