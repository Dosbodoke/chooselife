export type Representation = "html" | "markdown" | "not-acceptable";

type MediaRange = {
  type: string;
  subtype: string;
  quality: number;
  order: number;
};

type Match = MediaRange & {
  specificity: number;
};

const REPRESENTATIONS = [
  { name: "markdown" as const, type: "text", subtype: "markdown" },
  { name: "html" as const, type: "text", subtype: "html" },
];

function parseAcceptHeader(header: string): MediaRange[] {
  return header
    .split(",")
    .map((part, order) => {
      const [rawMediaType, ...rawParameters] = part.split(";");
      const mediaTypeMatch = rawMediaType
        .trim()
        .toLowerCase()
        .match(/^([^/\s]+)\s*\/\s*([^/\s]+)$/);

      if (!mediaTypeMatch) return null;

      const qualityParameter = rawParameters.find((parameter) => {
        return /^q\s*=/.test(parameter.trim().toLowerCase());
      });
      const quality = qualityParameter
        ? Number(qualityParameter.trim().replace(/^q\s*=\s*/i, ""))
        : 1;

      if (!Number.isFinite(quality) || quality < 0 || quality > 1) {
        return null;
      }

      return {
        type: mediaTypeMatch[1],
        subtype: mediaTypeMatch[2],
        quality,
        order,
      };
    })
    .filter((range): range is MediaRange => range !== null);
}

function getBestMatch(
  ranges: MediaRange[],
  type: string,
  subtype: string,
): Match | null {
  const matches = ranges
    .map((range) => {
      const typeMatches = range.type === "*" || range.type === type;
      const subtypeMatches = range.subtype === "*" || range.subtype === subtype;

      if (!typeMatches || !subtypeMatches) return null;

      return {
        ...range,
        specificity:
          (range.type === "*" ? 0 : 1) + (range.subtype === "*" ? 0 : 1),
      };
    })
    .filter((match): match is Match => match !== null)
    .sort(
      (left, right) =>
        right.specificity - left.specificity || left.order - right.order,
    );

  return matches[0] || null;
}

export function negotiateRepresentation(
  acceptHeader: string | null,
): Representation {
  if (!acceptHeader?.trim()) return "html";

  const ranges = parseAcceptHeader(acceptHeader);
  const candidates = REPRESENTATIONS.map((representation) => {
    const match = getBestMatch(
      ranges,
      representation.type,
      representation.subtype,
    );

    return {
      ...representation,
      quality: match?.quality || 0,
      specificity: match?.specificity ?? -1,
      order: match?.order ?? Number.MAX_SAFE_INTEGER,
    };
  }).filter((candidate) => candidate.quality > 0);

  if (candidates.length === 0) return "not-acceptable";

  candidates.sort(
    (left, right) =>
      right.quality - left.quality ||
      right.specificity - left.specificity ||
      left.order - right.order ||
      (left.name === "html" ? -1 : 1),
  );

  return candidates[0].name;
}
