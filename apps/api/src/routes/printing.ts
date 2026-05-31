import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';
import {
  getSpineLabelPdf,
  getMetadataCardPdf,
  getSpineZpl,
  getBulkLabelsPdf,
  getCopyByBarcode,
} from '../services/printing/index.js';

export const printingRouter = new Hono();

printingRouter.get('/print/label/:copy_id', requireAuth, async (c) => {
  const pdf = await getSpineLabelPdf(c.req.param('copy_id'));
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="spine-label.pdf"',
    },
  });
});

printingRouter.get('/print/card/:copy_id', requireAuth, async (c) => {
  const pdf = await getMetadataCardPdf(c.req.param('copy_id'));
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="metadata-card.pdf"',
    },
  });
});

printingRouter.get('/print/label/:copy_id/zpl', requireAuth, async (c) => {
  const zpl = await getSpineZpl(c.req.param('copy_id'));
  c.header('Content-Type', 'text/plain');
  return c.text(zpl);
});

printingRouter.get('/print/bulk-labels', requireAuth, async (c) => {
  const idsParam = c.req.query('ids') ?? '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return c.json({ success: false, error: 'No copy IDs provided', code: 'VALIDATION_ERROR' }, 400);
  }
  if (ids.length > 50) {
    return c.json({ success: false, error: 'Maximum 50 copies per batch', code: 'VALIDATION_ERROR' }, 400);
  }

  const pdf = await getBulkLabelsPdf(ids);
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="bulk-labels.pdf"',
    },
  });
});

printingRouter.get('/copies/barcode/:barcode', requireAuth, async (c) => {
  try {
    const result = await getCopyByBarcode(c.req.param('barcode'));
    return c.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError && err.code === 'NOT_FOUND') {
      return c.json({ success: false, error: 'Copy not found', code: 'NOT_FOUND' }, 404);
    }
    throw err;
  }
});
