import { supabase } from '~/lib/supabase';

const DEFAULT_R2_PUBLIC_URL = 'https://cdn.chooselife.club';
const DEFAULT_WEB_URL = 'https://chooselife.club';

const R2_PUBLIC_URL =
  process.env.EXPO_PUBLIC_R2_PUBLIC_URL || DEFAULT_R2_PUBLIC_URL;
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || DEFAULT_WEB_URL;

/**
 * Returns the public CDN URL for a file in R2 storage.
 */
export function getR2PublicUrl(bucket: string, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = R2_PUBLIC_URL.replace(/\/+$/, '');
  const normalizedBucket = bucket.replace(/^\/+|\/+$/g, '');
  const normalizedPath = path.replace(/^\/+/, '');

  return `${baseUrl}/${normalizedBucket}/${normalizedPath}`;
}

/**
 * Uploads a file to R2 via presigned URL from the API.
 * Returns the file key (path) on success.
 */
export async function uploadToR2(
  bucket: string,
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  // Get presigned URL from API
  const presignRes = await fetch(`${WEB_URL}/api/storage/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-access-token=${token}`,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bucket, key, contentType }),
  });

  if (!presignRes.ok) {
    const error = await presignRes.text();
    throw new Error(`Failed to get presigned URL: ${error}`);
  }

  const { presignedUrl, key: resolvedKey } = await presignRes.json();

  // Upload directly to R2
  const uploadBody = body instanceof Uint8Array ? body.buffer : body;

  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: uploadBody as BodyInit,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to R2');
  }

  return resolvedKey;
}

/**
 * Deletes a file from R2 via the API.
 */
export async function deleteFromR2(
  bucket: string,
  key: string,
): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  if (!token) {
    throw new Error('Not authenticated');
  }

  const res = await fetch(`${WEB_URL}/api/storage/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-access-token=${token}`,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ bucket, key }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Failed to delete file: ${error}`);
  }
}
