import type { QueryData } from '@supabase/supabase-js';

import type {
  getNewsByOrganizationQuery,
  getNewsItemBySlugQuery,
  getNewsSlugsQuery,
} from './queries';

export type NewsRecord = QueryData<ReturnType<typeof getNewsByOrganizationQuery>>[number] & {
  organizations: { slug: string } | null;
};

export type News = NewsRecord[];
export type NewsItem = QueryData<ReturnType<typeof getNewsItemBySlugQuery>>;
export type NewsSlugs = QueryData<ReturnType<typeof getNewsSlugsQuery>>;
