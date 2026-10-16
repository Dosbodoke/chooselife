export type IsaLinkErrorKey = 'alreadyLinked' | 'notVerified' | 'linkFailed';

/** Maps a `link-isa-account` HTTP status to the message shown to the member. */
export const getIsaLinkErrorKey = (
  status: number | undefined,
): IsaLinkErrorKey => {
  if (status === 409) return 'alreadyLinked';
  if (status === 401) return 'notVerified';
  return 'linkFailed';
};
