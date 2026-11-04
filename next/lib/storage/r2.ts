export const R2_PUBLIC_URL =
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "https://cdn.chooselife.club";

/**
 * Returns the public CDN URL for a file in R2 storage.
 * @param bucket - The logical bucket name (e.g., "images", "avatars", "promo")
 * @param path - The file path within the bucket
 */
export function getR2PublicUrl(bucket: string, path: string): string {
  return `${R2_PUBLIC_URL}/${bucket}/${path}`;
}

/**
 * Resolves a `profiles.profile_picture` value to something an `<img>` can load.
 * Google sign-in stores the full URL; a picture uploaded from the app stores
 * only its R2 key (`<user id>/<timestamp>.jpg`), which on its own resolves
 * against the page and 404s.
 */
export function profilePictureUrl(
  picture: string | null | undefined,
): string | null {
  if (!picture) return null;
  if (/^https?:\/\//i.test(picture)) return picture;
  return getR2PublicUrl("avatars", picture.replace(/^\/+/, ""));
}
