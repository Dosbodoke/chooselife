"use server";

import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database, Functions } from "@/utils/supabase/database.types";

type Props = {
  id?: string[];
  searchValue?: string;
  pageParam?: number;
  pageSize?: number;
};

export type Highline = Functions["get_highline"]["Returns"][0];

export const getHighline = async ({
  pageParam,
  searchValue,
  pageSize,
  id,
}: Props) => {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const result = await supabase.rpc("get_highline", {
    ...(id && id.length > 0 ? { searchid: id } : {}),
    ...(user?.id ? { userid: user.id } : {}),
    ...(searchValue ? { searchname: searchValue } : {}),
    ...(pageParam && pageSize
      ? { pageparam: pageParam, pagesize: pageSize }
      : {}),
  });

  return result;
};
