import type {
  FestivalHighline,
  FestivalHighlineLink,
  FestivalHighlineQueueCard,
  FestivalQueueEntry,
  FestivalQueueEntryRecord,
  FestivalQueueSectorGroup,
  FestivalQueueSummary,
  FestivalSector,
} from "./types";

function toActiveEntry(
  entry: FestivalQueueEntryRecord,
  queuePosition: number,
): FestivalQueueEntry {
  return {
    id: entry.id,
    festival_id: entry.festival_id,
    highline_id: entry.highline_id,
    profile_id: entry.profile_id,
    display_name: entry.display_name,
    status: entry.status,
    joined_at: entry.joined_at,
    called_at: entry.called_at,
    completed_at: entry.completed_at,
    removed_at: entry.removed_at,
    removed_by: entry.removed_by,
    queuePosition,
  };
}

export function buildFestivalQueueSummary(args: {
  entries: FestivalQueueEntryRecord[];
  viewerId?: string;
  previewSize?: number;
}): FestivalQueueSummary {
  const previewSize = args.previewSize ?? 3;
  const activeEntries = [...args.entries]
    .filter((entry) => entry.status === "waiting" || entry.status === "called")
    .sort((a, b) => {
      const joinedAtDiff =
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();

      if (joinedAtDiff !== 0) {
        return joinedAtDiff;
      }

      return a.id.localeCompare(b.id);
    });

  const calledEntryRecord =
    activeEntries.find((entry) => entry.status === "called") ?? null;
  const waitingRecords = activeEntries.filter((entry) => entry.status === "waiting");

  const orderedEntries = [
    ...(calledEntryRecord ? [calledEntryRecord] : []),
    ...waitingRecords,
  ].map((entry, index) => toActiveEntry(entry, index + 1));

  const calledEntry = orderedEntries.find((entry) => entry.status === "called") ?? null;
  const viewerEntry =
    args.viewerId
      ? orderedEntries.find((entry) => entry.profile_id === args.viewerId) ?? null
      : null;

  return {
    activeEntries: orderedEntries,
    calledEntry,
    nextEntries: orderedEntries
      .filter((entry) => entry.status === "waiting")
      .slice(0, previewSize),
    waitingCount: waitingRecords.length,
    viewerEntry,
    viewerPosition: viewerEntry?.queuePosition ?? null,
  };
}

export function buildFestivalHighlineQueueCards(args: {
  highlines: FestivalHighline[];
  links: FestivalHighlineLink[];
  sectors: Pick<FestivalSector, "id" | "name" | "description">[];
  queueEntries: FestivalQueueEntryRecord[];
  viewerId?: string;
}): FestivalHighlineQueueCard[] {
  const highlineById = new Map(args.highlines.map((highline) => [highline.id, highline]));
  const sectorById = new Map(args.sectors.map((sector) => [sector.id, sector]));
  const entriesByHighline = new Map<string, FestivalQueueEntryRecord[]>();

  for (const entry of args.queueEntries) {
    const entries = entriesByHighline.get(entry.highline_id) ?? [];
    entries.push(entry);
    entriesByHighline.set(entry.highline_id, entries);
  }

  return args.links
    .map((link) => {
      const highline = highlineById.get(link.highlineId);
      if (!highline) return null;

      const sector = highline.sector_id
        ? sectorById.get(highline.sector_id) ?? null
        : null;

      return {
        highline,
        queueSummary: buildFestivalQueueSummary({
          entries: entriesByHighline.get(highline.id) ?? [],
          viewerId: args.viewerId,
        }),
        sector,
        sortOrder: link.sortOrder,
      } satisfies FestivalHighlineQueueCard;
    })
    .filter((card): card is FestivalHighlineQueueCard => card !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function groupFestivalCardsBySector(
  cards: FestivalHighlineQueueCard[],
): FestivalQueueSectorGroup[] {
  const groups = new Map<string, FestivalQueueSectorGroup>();

  for (const card of cards) {
    const groupKey = card.sector ? `sector:${card.sector.id}` : "sector:none";
    const existing = groups.get(groupKey);
    if (existing) {
      existing.cards.push(card);
      continue;
    }

    groups.set(groupKey, {
      sector: card.sector,
      cards: [card],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    cards: group.cards.sort(
      (a: FestivalHighlineQueueCard, b: FestivalHighlineQueueCard) =>
        a.sortOrder - b.sortOrder,
    ),
  }));
}
