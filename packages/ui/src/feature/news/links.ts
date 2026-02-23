const trimTrailingSlash = (url: string) => url.replace(/\/+$/, '');

export const buildNewsPath = (slug: string) => `/news/${encodeURIComponent(slug)}`;

export const buildNewsWebUrl = (baseUrl: string, slug: string) => {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl.trim());

  if (!normalizedBaseUrl) {
    return buildNewsPath(slug);
  }

  return `${normalizedBaseUrl}${buildNewsPath(slug)}`;
};
