import Image from "next/image";
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
