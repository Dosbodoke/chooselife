export const NAV_THEME = {
  light: {
    background: "hsl(0 0% 100%)", // background
    border: "hsl(240 5.9% 90%)", // border
    card: "hsl(0 0% 100%)", // card
    notification: "hsl(0 84.2% 60.2%)", // destructive
    primary: "hsl(240 5.9% 10%)", // primary
    text: "hsl(240 10% 3.9%)", // foreground
  },
  dark: {
    background: "hsl(240 10% 3.9%)", // background
    border: "hsl(240 3.7% 15.9%)", // border
    card: "hsl(240 10% 3.9%)", // card
    notification: "hsl(0 72% 51%)", // destructive
    primary: "hsl(0 0% 98%)", // primary
    text: "hsl(0 0% 98%)", // foreground
  },
};

// For MapView
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
