"use client";

import { useQueries } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  UnfoldHorizontalIcon,
  UnfoldVerticalIcon,
} from "lucide-react";
import { useQueryState } from "nuqs";
import React from "react";

import { getHighline } from "@/app/actions/getHighline";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

import HighlineImage from "../HighlineImage";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export const Selected = ({
  highlineIds,
  focusedMarker,
}: {
  highlineIds: string[];
  focusedMarker: string | null;
}) => {
  const [, setFocusedMarker] = useQueryState("focusedMarker");
  const { data, pending } = useQueries({
    queries: highlineIds.map((id) => ({
      queryKey: ["highline", id],
      queryFn: async () => getHighline({ id: [id] }),
    })),
    combine: (results) => {
      return {
        data: results.map((result) =>
          result.data && result.data.data && result.data.data?.length > 0
            ? result.data.data[0]
            : null
        ),
        pending: results.some((result) => result.isPending),
      };
    },
  });

  if (highlineIds.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute bottom-0 z-[1000] w-full rounded-t-3xl px-2 py-4"
      )}
    >
      <div className="flex gap-2 overflow-auto whitespace-nowrap">
        {pending ? (
          <SelectedSkeleton quantity={data.length} />
        ) : (
          data.map((selected) => {
            // TODO: Remove `null` values from the data array so this check is not necessary
            if (!selected) return null;
            return (
              <Card
                className="inline-block aspect-video min-w-[20rem] cursor-pointer overflow-hidden bg-card hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-accent"
                onClick={() => {
                  if (focusedMarker !== selected.id) {
                    setFocusedMarker(selected.id);
                  }
                }}
                key={selected.id}
              >
                <CardContent
                  className="group relative h-full w-full overflow-hidden rounded-xl p-0"
                  data-active={focusedMarker === selected.id}
                >
                  <div className="absolute inset-0 overflow-hidden">
                    <HighlineImage coverImageId={selected.cover_image} />
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-2 rounded-md bg-white p-2 group-data-[active=true]:border-2 group-data-[active=true]:border-blue-500">
                    <h4 className="text-sm font-semibold text-black">
                      {selected.name}
                    </h4>
                    <div className="flex gap-2">
                      <div className="flex items-center pt-2">
                        <UnfoldVerticalIcon className="mr-2 h-4 w-4 text-gray-700" />{" "}
                        <span className="text-sm text-gray-500">
                          {selected.height}m
                        </span>
                      </div>
                      <div className="flex items-center pt-2">
                        <UnfoldHorizontalIcon className="mr-2 h-4 w-4 text-gray-700" />{" "}
                        <span className="text-sm text-gray-500">
                          {selected.length}m
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="group-hover:border-accent-foreground group-hover:bg-accent group-data-[active=true]:border-accent-foreground group-data-[active=true]:bg-accent"
                      asChild
                    >
                      <Link
                        className="pointer-events-auto mt-auto"
                        href={`/highline/${selected.id}`}
                      >
                        Ver detalhes
                        <ArrowRightIcon className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

const SelectedSkeleton = ({ quantity }: { quantity: number }) => {
  return (
    <>
      {Array.from(Array(quantity)).map((_, idx) => (
        <Card
          key={`high-skeleton-${idx}`}
          className="group inline-block aspect-video min-w-[20rem] overflow-hidden border-2 border-muted bg-accent"
        >
          <CardContent className="relative flex h-full gap-2 p-0">
            <div className="absolute h-full w-full animate-pulse rounded-l-md bg-muted-foreground opacity-70" />
            <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-2 rounded-md bg-white p-2">
              <h4 className="h-6 w-4/5 rounded-md bg-muted-foreground opacity-70" />
              <div className="flex gap-2">
                <div className="flex items-center pt-2">
                  <UnfoldVerticalIcon className="mr-2 h-4 w-4 opacity-70" />{" "}
                  <span className="h-4 w-8 rounded-sm bg-muted-foreground opacity-70"></span>
                </div>
                <div className="flex items-center pt-2">
                  <UnfoldHorizontalIcon className="mr-2 h-4 w-4 opacity-70" />{" "}
                  <span className="h-4 w-8 rounded-sm bg-muted-foreground opacity-70"></span>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-auto bg-muted-foreground opacity-70"
              ></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
};
