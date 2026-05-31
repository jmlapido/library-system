import { describe, it, expect, vi, beforeAll } from 'vitest';
import { app } from '../index.js';
import { signAccessToken } from '../lib/jwt.js';
import { AppError } from '../utils/errors.js';
import {
  getSpineLabelPdf,
  getCoverLabelPdf,
  getMetadataCardPdf,
  getSpineZpl,
  getBulkLabelsPdf,
  getCopyByBarcode,
} from '../services/printing/index.js';

vi.mock('../services/printing/index.js', () => ({
  getSpineLabelPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
  getCoverLabelPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
  getMetadataCardPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
  getSpineZpl: vi.fn().mockResolvedValue('^XA^XZ'),
  getBulkLabelsPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
  getCopyByBarcode: vi.fn().mockResolvedValue({
    copy: { id: 'c1', barcode: 'SCAN123', status: 'available' },
    book: { title: 'Test Book', author: 'Author' },
  }),
}));

let token: string;

beforeAll(() => {
  token = signAccessToken({ sub: 'user-uuid', role: 'librarian', schoolId: 'school-uuid' });
});

describe('GET /api/v1/copies/barcode/:barcode', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/copies/barcode/SCAN123');
    expect(res.status).toBe(401);
  });

  it('returns 200 JSON with copy and book when found', async () => {
    const res = await app.request('/api/v1/copies/barcode/SCAN123', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('returns 404 when getCopyByBarcode throws NOT_FOUND', async () => {
    vi.mocked(getCopyByBarcode).mockRejectedValueOnce(
      new AppError('NOT_FOUND', 'not found')
    );
    const res = await app.request('/api/v1/copies/barcode/MISSING', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(404);
    const body = await res.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/v1/print/bulk-labels', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/print/bulk-labels?ids=a,b,c');
    expect(res.status).toBe(401);
  });

  it('returns 400 when no ids query param provided', async () => {
    const res = await app.request('/api/v1/print/bulk-labels', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when ids param is empty string', async () => {
    const res = await app.request('/api/v1/print/bulk-labels?ids=', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 with application/pdf when valid ids provided', async () => {
    const res = await app.request('/api/v1/print/bulk-labels?ids=a,b,c', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });
});

describe('GET /api/v1/print/label/:copy_id', () => {
  it('returns 401 without auth token', async () => {
    const res = await app.request('/api/v1/print/label/copy-uuid');
    expect(res.status).toBe(401);
  });

  it('returns 200 with application/pdf when authenticated', async () => {
    const res = await app.request('/api/v1/print/label/copy-uuid', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });
});

describe('GET /api/v1/print/card/:copy_id', () => {
  it('returns 200 with application/pdf when authenticated', async () => {
    const res = await app.request('/api/v1/print/card/copy-uuid', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });
});

describe('GET /api/v1/print/label/:copy_id/zpl', () => {
  it('returns 200 with text/plain ZPL content', async () => {
    const res = await app.request('/api/v1/print/label/copy-uuid/zpl', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const text = await res.text();
    expect(text).toBe('^XA^XZ');
  });
});
