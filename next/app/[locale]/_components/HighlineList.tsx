"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useQueryState } from "nuqs";

import { getHighline } from "@/app/actions/getHighline";

import { Highline } from "./Highline";
import { HighlineListSkeleton } from "./HighlineListSkeleton";

const PAGE_SIZE = 6;

type HighlineListProps = {
  layout?: "grid" | "rail";
};

export function HighlineList({ layout = "grid" }: HighlineListProps) {
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

  const listClassName =
    layout === "rail"
      ? "flex snap-x gap-4 overflow-x-auto pb-4 md:gap-5"
      : "grid grid-cols-1 justify-items-center gap-4 md:grid-cols-2 lg:grid-cols-3";
  const cardClassName =
    layout === "rail" ? "min-w-[18rem] snap-start md:min-w-[20rem]" : undefined;

  return (
    <>
      <section className={listClassName}>
        {data?.pages.map((page) =>
          page.data?.map((high) => (
            <Highline key={high.id} highline={high} classname={cardClassName} />
          )),
        )}
        {isFetching ? <HighlineListSkeleton layout={layout} /> : null}
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
