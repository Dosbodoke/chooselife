/**
 * Convert HTML to Markdown (basic conversion for common tags)
 * Used for ISA Calendar descriptions which come as HTML
 */
export function htmlToMarkdown(html: string | null | undefined): string {
  if (!html) return '';

  let result = html;

  // Convert line breaks
  result = result.replace(/<br\s*\/?>/gi, '\n');

  // Convert bold
  result = result.replace(/<b>(.*?)<\/b>/gi, '**$1**');
  result = result.replace(/<strong>(.*?)<\/strong>/gi, '**$1**');

  // Convert italic
  result = result.replace(/<i>(.*?)<\/i>/gi, '*$1*');
  result = result.replace(/<em>(.*?)<\/em>/gi, '*$1*');

  // Convert underline (no markdown equivalent, use bold)
  result = result.replace(/<u>(.*?)<\/u>/gi, '_$1_');

  // Convert links
  result = result.replace(/<a\s+href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Convert paragraphs
  result = result.replace(/<p>(.*?)<\/p>/gi, '$1\n\n');

  // Convert headings
  result = result.replace(/<h1>(.*?)<\/h1>/gi, '# $1\n');
  result = result.replace(/<h2>(.*?)<\/h2>/gi, '## $1\n');
  result = result.replace(/<h3>(.*?)<\/h3>/gi, '### $1\n');

  // Convert lists
  result = result.replace(/<li>(.*?)<\/li>/gi, '• $1\n');
  result = result.replace(/<\/?[uo]l>/gi, '');

  // Remove remaining HTML tags
  result = result.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  result = result.replace(/&nbsp;/gi, ' ');
  result = result.replace(/&amp;/gi, '&');
  result = result.replace(/&lt;/gi, '<');
  result = result.replace(/&gt;/gi, '>');
  result = result.replace(/&quot;/gi, '"');
  result = result.replace(/&#39;/gi, "'");

  // Clean up multiple newlines
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace
  result = result.trim();

  return result;
}

/**
 * Strip all HTML tags and return plain text
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  let result = html;

  // Convert line breaks to spaces
  result = result.replace(/<br\s*\/?>/gi, ' ');

  // Remove all HTML tags
  result = result.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  result = result.replace(/&nbsp;/gi, ' ');
  result = result.replace(/&amp;/gi, '&');
  result = result.replace(/&lt;/gi, '<');
  result = result.replace(/&gt;/gi, '>');
  result = result.replace(/&quot;/gi, '"');
  result = result.replace(/&#39;/gi, "'");

  // Clean up multiple spaces
  result = result.replace(/\s+/g, ' ');

  return result.trim();
}
