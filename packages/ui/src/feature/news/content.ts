export const DEFAULT_NEWS_TITLE = 'Ver Publicação';

const NEWS_TITLE_REGEX = /^#\s+([^\n]+)/m;

const cleanMarkdownInlineTokens = (value: string) =>
  value.replace(/[*_~`]+/g, '').trim();

export function extractNewsTitleFromMarkdown(
  content: string,
  fallback = DEFAULT_NEWS_TITLE,
): string {
  if (!content) {
    return fallback;
  }

  const headerMatch = content.trim().match(NEWS_TITLE_REGEX);
  const titleCandidate = headerMatch?.[1] ? cleanMarkdownInlineTokens(headerMatch[1]) : '';

  return titleCandidate || fallback;
}

export function buildNewsPreview(
  content: string,
  charLimit = 500,
): { previewContent: string; isClamped: boolean } {
  if (!content) {
    return { previewContent: '', isClamped: false };
  }

  if (content.length <= charLimit) {
    return { previewContent: content, isClamped: false };
  }

  const end = content.indexOf('\n', charLimit);
  if (end !== -1) {
    return { previewContent: content.slice(0, end), isClamped: true };
  }

  return { previewContent: content, isClamped: false };
}
