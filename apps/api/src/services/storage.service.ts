import { S3Client, PutObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.MINIO_BUCKET ?? 'librams-covers';
const ENDPOINT = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000';
const PUBLIC_URL = process.env.MINIO_PUBLIC_URL ?? ENDPOINT;

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  },
  forcePathStyle: true,
});

/** Creates the covers bucket if it doesn't already exist. */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/**
 * Uploads a book cover image to MinIO and returns its public URL.
 * @param bookId - Used as the object key prefix.
 * @param file - Raw binary of the image.
 * @param contentType - MIME type of the image.
 * @returns The public URL of the uploaded cover.
 */
export async function uploadBookCover(bookId: string, file: Uint8Array, contentType: string): Promise<string> {
  const ext = contentType.split('/')[1] ?? 'jpg';
  const key = `covers/${bookId}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
  }));
  return `${PUBLIC_URL}/${BUCKET}/${key}`;
}

/**
 * Deletes a book cover object from MinIO.
 * @param coverUrl - The full URL previously returned by uploadBookCover.
 */
export async function deleteBookCover(coverUrl: string): Promise<void> {
  const url = new URL(coverUrl);
  const key = url.pathname.replace(`/${BUCKET}/`, '');
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
