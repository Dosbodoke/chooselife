/** Deep link into the ChooseLife app, e.g. `getAppUrl("highline/123/rig")`. */
export function getAppUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_APP_SCHEME}://${path}`;
}
