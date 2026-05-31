import type { CopyLabelData } from './types.js';

/** Strip characters that could inject ZPL commands (^ ~ and control chars). */
function sanitizeZpl(value: string): string {
  return value.replace(/[\^~\x00-\x1F\x7F]/g, '').slice(0, 128);
}

/**
 * Generate ZPL for a spine label (barcode + call number).
 * @param data - The copy label data.
 */
export function generateSpineZpl(data: CopyLabelData): string {
  const callNum = sanitizeZpl(data.deweyDecimal ?? 'NO CALL');
  const barcode = sanitizeZpl(data.barcode);
  return [
    '^XA',
    '^CF0,20',
    `^FO10,10^BY2^BCN,60,Y,N,N^FD${barcode}^FS`,
    `^FO10,80^ADN,18,10^FD${callNum}^FS`,
    '^XZ',
  ].join('\n');
}

/**
 * Generate ZPL for a cover label (barcode + copy number).
 * @param data - The copy label data.
 */
export function generateCoverZpl(data: CopyLabelData): string {
  const barcode = sanitizeZpl(data.barcode);
  const copyLabel = data.copyNumber != null ? `Copy #${data.copyNumber}` : '';
  return [
    '^XA',
    '^CF0,18',
    `^FO10,10^BY2^BCN,50,Y,N,N^FD${barcode}^FS`,
    `^FO10,70^ADN,14,8^FD${copyLabel}^FS`,
    '^XZ',
  ].join('\n');
}
