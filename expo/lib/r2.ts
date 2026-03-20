import { supabase } from '~/lib/supabase';

const R2_PUBLIC_URL = process.env.EXPO_PUBLIC_R2_PUBLIC_URL!;
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL!;

/**
 * Returns the public CDN URL for a file in R2 storage.
 */
export function getR2PublicUrl(bucket: string, path: string): string {
  return `${R2_PUBLIC_URL}/${bucket}/${path}`;
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

  const { presignedUrl } = await presignRes.json();

  // Upload directly to R2
  const uploadRes = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload file to R2');
  }

  return key;
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
