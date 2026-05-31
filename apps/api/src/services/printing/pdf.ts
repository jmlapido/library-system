import PDFDocument = require('pdfkit');
import { generateBarcodePng, generateQrPng } from './barcode.js';
import type { CopyLabelData } from './types.js';

type PDFDoc = InstanceType<typeof PDFDocument>;

/**
 * Collect PDFDocument output into a single Buffer.
 * @param doc - The PDFKit document (must not have called end() yet).
 */
function docToBuffer(doc: PDFDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Generate a spine label PDF (narrow strip: 90x108pt) with barcode + call number.
 * @param data - The copy label data.
 */
export async function generateSpineLabelPdf(data: CopyLabelData): Promise<Buffer> {
  const doc = new PDFDocument({ size: [90, 108], margin: 4 });
  const png = await generateBarcodePng(data.barcode);
  doc.image(png, 4, 4, { width: 82 });
  doc.fontSize(7).text(data.deweyDecimal ?? '', 4, 70, { width: 82, align: 'center' });
  return docToBuffer(doc);
}

/**
 * Generate a cover label PDF (144x72pt) with barcode + copy number.
 * @param data - The copy label data.
 */
export async function generateCoverLabelPdf(data: CopyLabelData): Promise<Buffer> {
  const doc = new PDFDocument({ size: [144, 72], margin: 4 });
  const png = await generateBarcodePng(data.barcode);
  doc.image(png, 4, 4, { width: 136, height: 50 });
  const copyLabel = data.copyNumber != null ? `Copy #${data.copyNumber}` : '';
  doc.fontSize(7).text(copyLabel, 4, 58, { width: 136, align: 'center' });
  return docToBuffer(doc);
}

/**
 * Generate a full metadata card PDF (288x432pt) with title, author, call number, barcode, and QR code.
 * @param data - The copy label data.
 */
export async function generateMetadataCardPdf(data: CopyLabelData): Promise<Buffer> {
  const doc = new PDFDocument({ size: [288, 432], margin: 12 });
  doc.fontSize(9).font('Helvetica-Bold').text(data.schoolName, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(11).font('Helvetica-Bold').text(data.bookTitle, { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(data.bookAuthor, { align: 'center' });
  doc.moveDown(0.3);
  if (data.deweyDecimal) doc.fontSize(8).text(`Call #: ${data.deweyDecimal}`);
  if (data.isbn) doc.fontSize(8).text(`ISBN: ${data.isbn}`);
  if (data.publisher) doc.fontSize(8).text(`Publisher: ${data.publisher}`);
  if (data.publicationYear) doc.fontSize(8).text(`Year: ${data.publicationYear}`);
  if (data.copyNumber != null) doc.fontSize(8).text(`Copy: #${data.copyNumber}`);
  doc.moveDown(0.5);
  const barcodePng = await generateBarcodePng(data.barcode);
  doc.image(barcodePng, 44, doc.y, { width: 200 });
  doc.moveDown(3.5);
  const bookUrl = `${data.appUrl}/books/${data.isbn ?? data.copyId}`;
  const qrPng = await generateQrPng(bookUrl);
  doc.image(qrPng, 100, doc.y, { width: 88 });
  return docToBuffer(doc);
}

/**
 * Generate a bulk label PDF (LETTER) — one copy per page with barcode and metadata line.
 * @param copies - Array of copy label data to include.
 */
export async function generateBulkLabelPdf(copies: CopyLabelData[]): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 36 });

  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let first = true;
  for (const copy of copies) {
    if (!first) doc.addPage();
    first = false;
    doc.fontSize(10).font('Helvetica-Bold').text(
      `${copy.bookTitle} — Copy #${copy.copyNumber ?? '?'}`,
      { align: 'center' }
    );
    doc.moveDown(0.3);
    const png = await generateBarcodePng(copy.barcode);
    doc.image(png, 100, doc.y, { width: 320 });
    doc.moveDown(2);
    doc.fontSize(8).font('Helvetica').text(
      `Barcode: ${copy.barcode}  |  Call #: ${copy.deweyDecimal ?? '—'}  |  ${copy.bookAuthor}`,
      { align: 'center' }
    );
  }

  doc.end();
  return bufferPromise;
}
