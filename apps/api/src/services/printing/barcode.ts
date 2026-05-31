import * as bwipjs from 'bwip-js';

/**
 * Generate a Code 128 barcode PNG buffer.
 * @param text - The barcode text to encode.
 */
export async function generateBarcodePng(text: string): Promise<Buffer> {
  const buf: Buffer = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: 'center',
  });
  return buf;
}

/**
 * Generate a QR code PNG buffer.
 * @param url - The URL to encode in the QR code.
 */
export async function generateQrPng(url: string): Promise<Buffer> {
  const buf: Buffer = await bwipjs.toBuffer({
    bcid: 'qrcode',
    text: url,
    scale: 4,
  });
  return buf;
}
