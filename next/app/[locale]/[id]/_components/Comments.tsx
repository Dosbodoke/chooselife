"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useFormatter } from "next-intl";
import React from "react";

import type { Highline } from "@/app/actions/getHighline";
import LoadingSkeleton from "@/components/Ranking/LoadingSkeleton";
import { UsernameLink } from "@/components/Ranking/UsernameLink";
import SeeMore from "@/components/SeeMore";
import useSupabaseBrowser from "@/utils/supabase/client";

interface Props {
  highline: Highline;
}

const PAGE_SIZE = 5;

function Comments({ highline }: Props) {
  const supabase = useSupabaseBrowser();
  const format = useFormatter();

  async function fetchComments({ pageParam }: { pageParam: number }) {
    const { data } = await supabase
      .from("entry")
      .select("comment, created_at, instagram")
      .not("comment", "eq", "")
      .not("comment", "eq", null)
      .match({ highline_id: highline.id })
      .order("created_at", { ascending: false })
      .range((pageParam - 1) * PAGE_SIZE, pageParam * PAGE_SIZE - 1);

    return data;
  }

  const {
    data: comments,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: ["entry", highline.id, "comments"],
    queryFn: ({ pageParam }) => fetchComments({ pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam, allPageParams) => {
      const nextPage = allPages.length + 1;
      return lastPage?.length === PAGE_SIZE ? nextPage : undefined;
    },
    enabled: !!highline.id,
  });

  if (isLoading) {
    return (
      <div className="mt-2 animate-pulse space-y-6">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="flex flex-col space-y-2">
            <div className="flex items-start space-x-2">
              <div className="h-4 w-32 rounded-md bg-gray-200 dark:bg-gray-700"></div>
              <div className="h-2 w-16 rounded-sm bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <div className="h-4 w-full max-w-xs rounded-md bg-gray-200 dark:bg-gray-700"></div>
            <div className="h-4 w-full max-w-sm rounded-md bg-gray-200 dark:bg-gray-700"></div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return <div>OOPS! Aconteceu algum error. Tente recarregar a página.</div>;
  }

  return (
    <div className="space-y-4">
      {comments?.pages.map((page) =>
        page?.map((comment) => (
          <div
            className="flex items-start space-x-4"
            key={`comment-${comment.created_at}`}
          >
            {/* <div className="relative flex-shrink-0">
              <Image
                src={"/default-profile-picture.png"}
                fill={true}
                alt="Profile picture"
                className="h-12 w-12 rounded-full"
              />
            </div> */}
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <UsernameLink username={comment.instagram} />
                <span className="text-xs text-muted-foreground">
                  {format.relativeTime(new Date(comment.created_at))}
                </span>
              </div>
              <p className="text-sm leading-none text-muted-foreground">
                {comment.comment}
              </p>
            </div>
          </div>
        ))
      )}
      {hasNextPage && (
        <SeeMore onClick={() => fetchNextPage()} disabled={isLoading} />
      )}
    </div>
  );
}

export default Comments;
