export const R2_PUBLIC_URL = "https://cdn.chooselife.club";

/**
 * Returns the public CDN URL for a file in R2 storage.
 * @param bucket - The logical bucket name (e.g., "images", "avatars", "promo")
 * @param path - The file path within the bucket
 */
export function getR2PublicUrl(bucket: string, path: string): string {
  return `${R2_PUBLIC_URL}/${bucket}/${path}`;
}
