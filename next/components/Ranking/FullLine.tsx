import { useInfiniteQuery } from "@tanstack/react-query";
import React from "react";

import useSupabaseBrowser from "@/utils/supabase/client";

import SeeMore from "../SeeMore";
import { Leaderboard } from "./leaderboard";
import LoadingSkeleton from "./LoadingSkeleton";

interface Props {
  highlines_ids: string[];
  startDate?: Date;
  endDate?: Date;
}

const PAGE_SIZE = 5;

function FullLine({ highlines_ids, startDate, endDate }: Props) {
  const supabase = useSupabaseBrowser();

  async function fetchFullLine({ pageParam = 1 }) {
    const { data } = await supabase.rpc("get_total_full_lines", {
      highline_ids: highlines_ids,
      page_number: pageParam,
      page_size: PAGE_SIZE,
      start_date: startDate?.toISOString(),
      end_date: endDate?.toISOString(),
    });
    return data;
  }

  const {
    data: entries,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["entry", highlines_ids, "fullLine"],
    queryFn: ({ pageParam }) => fetchFullLine({ pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const nextPage = pages.length + 1;
      return lastPage?.length === PAGE_SIZE ? nextPage : undefined;
    },
    enabled: !!highlines_ids.length,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return <div>OOPS! Aconteceu algum error. Tente recarregar a página.</div>;
  }

  return (
    <>
      <Leaderboard
        entries={
          entries?.pages.flatMap((page, pageIdx) => {
            return (
              page?.map((entry, idx) => {
                return {
                  name: entry.instagram,
                  position: pageIdx * PAGE_SIZE + idx + 1,
                  value: entry.total_full_lines.toString(),
                  profilePicture: entry.profile_picture,
                };
              }) || []
            );
          }) || [null, null, null]
        }
      />
      {hasNextPage && (
        <SeeMore onClick={() => fetchNextPage()} disabled={isLoading} />
      )}
    </>
  );
}

export default FullLine;
