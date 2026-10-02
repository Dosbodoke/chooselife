"use client";

// THROWAWAY: compare grid, compact list, and split detail layouts on /?variant=.
// Question: how should people browse many highlines without a long horizontal strip?
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";

import { getHighline } from "@/app/actions/getHighline";
import {
  productionSample,
  type PrototypeLine,
} from "./highline-sample.prototype";
import HighlineImage from "@/components/HighlineImage";
import { Link } from "@/i18n/navigation";

const variants = ["A", "B", "C"] as const;
const labels = { A: "Paged card grid", B: "Compact list", C: "List + detail" };
const PAGE_SIZE = 12;

function Dimensions({ line }: { line: PrototypeLine }) {
  return (
    <span className="text-sm text-muted-foreground">
      {Math.round(line.length)} m long · {Math.round(line.height)} m high
    </span>
  );
}

export function VariantA({ lines }: { lines: PrototypeLine[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {lines.map((line) => (
        <Link
          key={line.id}
          href={`/highline/${line.id}`}
          className="group overflow-hidden rounded-xl border bg-card"
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <HighlineImage coverImageId={line.cover_image} />
          </div>
          <div className="space-y-2 p-4">
            <h3 className="text-lg font-semibold">{line.name}</h3>
            <Dimensions line={line} />
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {line.description}
            </p>
            <span className="inline-flex items-center gap-2 pt-2 text-sm font-medium">
              Explore line <ArrowRight className="size-4" />
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function VariantB({ lines }: { lines: PrototypeLine[] }) {
  return (
    <div className="divide-y rounded-xl border bg-card">
      <div className="hidden grid-cols-[1fr_120px_120px_32px] gap-5 px-5 py-3 text-xs uppercase tracking-wider text-muted-foreground md:grid">
        <span>Highline</span>
        <span>Length</span>
        <span>Height</span>
        <span />
      </div>
      {lines.map((line, i) => (
        <Link
          key={line.id}
          href={`/highline/${line.id}`}
          className="grid grid-cols-[1fr_auto] items-center gap-5 px-4 py-4 hover:bg-muted/50 md:grid-cols-[1fr_120px_120px_32px] md:px-5"
        >
          <div className="flex min-w-0 items-center gap-4">
            <span className="hidden w-5 text-xs tabular-nums text-muted-foreground sm:block">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg">
              <HighlineImage coverImageId={line.cover_image} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold">{line.name}</h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {line.description || "Community highline"}
              </p>
              <div className="mt-1 md:hidden">
                <Dimensions line={line} />
              </div>
            </div>
          </div>
          <span className="hidden text-sm tabular-nums md:block">
            {Math.round(line.length)} m
          </span>
          <span className="hidden text-sm tabular-nums md:block">
            {Math.round(line.height)} m
          </span>
          <ArrowRight className="size-4" />
        </Link>
      ))}
    </div>
  );
}

export function VariantC({ lines }: { lines: PrototypeLine[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const line = lines.find((item) => item.id === selected) || lines[0];
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2fr)]">
      <div className="divide-y rounded-xl border bg-card">
        {lines.map((item) => (
          <button
            key={item.id}
            onClick={() => setSelected(item.id)}
            className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left ${line?.id === item.id ? "bg-muted" : "hover:bg-muted/40"}`}
            aria-pressed={line?.id === item.id}
          >
            <div>
              <h3 className="font-semibold">{item.name}</h3>
              <Dimensions line={item} />
            </div>
            <ChevronRight className="size-4 shrink-0" />
          </button>
        ))}
      </div>
      {line && (
        <article className="order-first overflow-hidden rounded-xl border bg-card lg:order-last lg:sticky lg:top-24">
          <div className="relative aspect-[16/9]">
            <HighlineImage coverImageId={line.cover_image} />
          </div>
          <div className="space-y-4 p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Selected highline
            </p>
            <h3 className="text-3xl font-semibold tracking-tight">
              {line.name}
            </h3>
            <Dimensions line={line} />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {line.description ||
                "Open this highline to explore its location and community details."}
            </p>
            <Link
              href={`/highline/${line.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background"
            >
              Open highline <ArrowRight className="size-4" />
            </Link>
          </div>
        </article>
      )}
    </div>
  );
}

export function HighlineLayoutsPrototype() {
  const [rawVariant, setVariant] = useQueryState("variant", {
    defaultValue: "A",
    clearOnDefault: false,
  });
  const [page, setPage] = useQueryState("prototypePage", { defaultValue: "1" });
  const [search] = useQueryState("q");
  const [source, setSource] = useQueryState("prototypeSource", {
    defaultValue: "sample",
  });
  const variant = variants.includes(rawVariant as (typeof variants)[number])
    ? (rawVariant as (typeof variants)[number])
    : "A";
  const pageNumber = Math.max(1, Number(page) || 1);
  const { data, isFetching } = useQuery({
    queryKey: ["prototype-highlines", source, search, pageNumber],
    queryFn: async () =>
      source === "sample"
        ? {
            data: productionSample
              .filter(
                (line) =>
                  !search ||
                  line.name.toLowerCase().includes(search.toLowerCase()),
              )
              .slice((pageNumber - 1) * PAGE_SIZE, pageNumber * PAGE_SIZE),
          }
        : getHighline({
            pageParam: pageNumber,
            pageSize: PAGE_SIZE,
            searchValue: search || undefined,
          }),
  });
  const lines = data?.data || [];
  const cycle = (direction: number) =>
    setVariant(
      variants[
        (variants.indexOf(variant) + direction + variants.length) %
          variants.length
      ],
    );
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">
          {labels[variant]} · {PAGE_SIZE} per page
        </span>
        <span className="text-xs text-muted-foreground">
          Read-only prototype
        </span>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <label>
          Data{" "}
          <select
            aria-label="Prototype data source"
            value={source}
            onChange={(event) => {
              void setSource(event.target.value);
              void setPage("1");
            }}
            className="ml-2 rounded-md border bg-background px-2 py-1"
          >
            <option value="sample">18 production samples</option>
            <option value="local">Local database</option>
          </select>
        </label>
        <span>
          Variant {variant} · page {pageNumber} · query {search || "all"}
        </span>
      </div>
      {isFetching ? (
        <div className="grid h-48 place-items-center rounded-xl border text-muted-foreground">
          Loading highlines…
        </div>
      ) : variant === "A" ? (
        <VariantA lines={lines} />
      ) : variant === "B" ? (
        <VariantB lines={lines} />
      ) : (
        <VariantC lines={lines} />
      )}
      <div className="mt-6 flex items-center justify-between border-t pt-5">
        <span className="text-sm text-muted-foreground">
          Page {pageNumber} · {lines.length} highlines shown
        </span>
        <div className="flex gap-2">
          <button
            disabled={pageNumber === 1 || isFetching}
            onClick={() => setPage(String(pageNumber - 1))}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-30"
          >
            Previous
          </button>
          <button
            disabled={lines.length < PAGE_SIZE || isFetching}
            onClick={() => setPage(String(pageNumber + 1))}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-30"
          >
            Next page
          </button>
        </div>
      </div>
      {process.env.NODE_ENV !== "production" && (
        <div
          ref={() => {
            const onKey = (event: KeyboardEvent) => {
              const target = event.target as HTMLElement;
              if (target.closest("input, textarea, select, [contenteditable]"))
                return;
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                void cycle(event.key === "ArrowLeft" ? -1 : 1);
              }
            };
            window.addEventListener("keydown", onKey);
            return () => window.removeEventListener("keydown", onKey);
          }}
          className="fixed bottom-5 left-1/2 z-[10000] flex -translate-x-1/2 items-center gap-4 whitespace-nowrap rounded-full border border-white/20 bg-stone-950 px-3 py-3 text-white shadow-xl"
        >
          <button
            aria-label="Previous prototype"
            onClick={() => cycle(-1)}
            className="rounded-full p-2 hover:bg-white/10"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-stone-400">
              Prototype · {variant}
            </p>
            <p className="text-sm font-medium">{labels[variant]}</p>
          </div>
          <button
            aria-label="Next prototype"
            onClick={() => cycle(1)}
            className="rounded-full p-2 hover:bg-white/10"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </>
  );
}
