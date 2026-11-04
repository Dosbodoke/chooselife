/**
 * The admin drawer is addressed by the URL itself: `member`, `period` and the
 * ledger filters all live in the query string. Sharing that address is what
 * lets a second admin land on the same person, in the same month, under the
 * same filters.
 */

export type CopyViewLinkResult = "copied" | "failed";

type ClipboardWriter = { writeText: (text: string) => Promise<void> };

/**
 * `navigator.clipboard` is missing outside a secure context -- e.g. the dev
 * server opened on a phone over the LAN -- and `writeText` rejects when the
 * page lacks focus or permission. Both have to reach the admin as a failure
 * rather than as a silent no-op that looks like it worked.
 */
export async function copyViewLink(
  clipboard: ClipboardWriter | undefined,
  href: string,
): Promise<CopyViewLinkResult> {
  if (!clipboard) return "failed";

  try {
    await clipboard.writeText(href);
    return "copied";
  } catch {
    return "failed";
  }
}

/** Ledger handles carry their "@"; profile routes do not. */
export function profilePath(handle: string) {
  return `/profile/${handle.replace(/^@/, "")}`;
}
