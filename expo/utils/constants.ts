export const INITIAL_REGION = {
  latitude: -15.7782081,
  longitude: -47.93371,
  latitudeDelta: 80,
  longitudeDelta: 80,
};
export const DEFAULT_LATITUDE = INITIAL_REGION.latitude;
export const DEFAULT_LONGITUDE = INITIAL_REGION.longitude;

export const DEFAULT_ZOOM = 12;
export const MIN_CLUSTER_SIZE = 30;

// For Supabase Storage
export const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
