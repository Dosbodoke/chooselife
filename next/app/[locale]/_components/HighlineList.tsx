"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useQueryState } from "nuqs";

import { getHighline } from "@/app/actions/getHighline";

import { Highline } from "./Highline";
import { HighlineListSkeleton } from "./HighlineListSkeleton";

const PAGE_SIZE = 6;

export function HighlineList() {
  const [searchValue = ""] = useQueryState("q");

  const { data, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery({
    queryKey: ["highlines", { searchValue }],
    queryFn: ({ pageParam }) =>
      getHighline({
        pageParam,
        searchValue: searchValue ?? undefined,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const nextPage = pages.length + 1;
      return lastPage.data?.length === PAGE_SIZE ? nextPage : undefined;
    },
  });

  return (
    <>
      <section className="grid grid-cols-1 justify-items-center gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.pages.map((page) =>
          page.data?.map((high) => <Highline key={high.id} highline={high} />)
        )}
        {isFetching ? <HighlineListSkeleton /> : null}
      </section>
      <motion.div
        key={data?.pages.length}
        className="h-2"
        viewport={{ once: true, margin: "0px" }}
        onViewportEnter={() => {
          if (hasNextPage) fetchNextPage();
        }}
      />
    </>
  );
}
