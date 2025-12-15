import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import React from "react";

import highlineWalkImg from "@/assets/images/highline-walk.webp";

export const HeroPromoCard = () => {
  const t = useTranslations("home");

  return (
    <div className="absolute inset-0 h-screen w-full overflow-hidden bg-stone-900">
      <Image
        className="absolute z-0 scale-105 animate-in fade-in duration-1000"
        src={highlineWalkImg}
        alt="Person walking on a Highline"
        fill
        sizes="100vw"
        priority
        placeholder="blur"
        style={{
          objectFit: "cover",
          objectPosition: "center",
        }}
      />

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Top Gradient for Navigation visibility */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />

      {/* Bottom Gradient - Crucial for blending into the list below */}
      <div className="absolute inset-x-0 bottom-0 h-[60vh] bg-gradient-to-t from-background via-stone-950/80 to-transparent" />

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 pb-32 text-center text-white">
        <Link href={"/news/introduzindo-slac"}>
          <button
            role="button"
            className="group relative grid overflow-hidden rounded-full px-4 py-1 shadow-[0_1000px_0_0_hsl(0_0%_20%)_inset] transition-colors duration-200 active:scale-[.98]"
          >
            <span>
              <span className="spark mask-gradient animate-flip before:animate-rotate absolute inset-0 h-[100%] w-[100%] overflow-hidden rounded-full [mask:linear-gradient(white,_transparent_50%)] before:absolute before:aspect-square before:w-[200%] before:rotate-[-90deg] before:bg-[conic-gradient(from_0deg,transparent_0_340deg,white_360deg)] before:content-[''] before:[inset:0_auto_auto_50%] before:[translate:-50%_-15%]" />
            </span>
            <span className="backdrop absolute inset-[1px] rounded-full bg-neutral-950 transition-colors duration-200 group-hover:bg-neutral-900" />
            <span className="absolute inset-x-0 bottom-0 h-full w-full bg-gradient-to-tr from-primary/20 blur-md"></span>
            <span className="z-10 flex items-center justify-center gap-1 py-0.5 text-sm text-neutral-100">
              ✨ Conheça a SL.A.C.
              <ArrowRightIcon className="size-3 ml-1 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
            </span>
          </button>
        </Link>
        <h1 className="text-6xl font-bold tracking-tighter drop-shadow-lg sm:text-7xl md:text-8xl">
          Choose Life
        </h1>
        <p className="mt-4 max-w-lg text-lg font-medium tracking-widest text-stone-200 sm:text-2xl">
          {t("hero.subtitle")}
        </p>
      </div>
    </div>
  );
};
