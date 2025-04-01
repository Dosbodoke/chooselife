import Image from "next/image";
import { useTranslations } from "next-intl";
import React from "react";

import { BorderBeam } from "@/components/ui/border-beam";
import { Link } from "@/navigation";

export const HeroPromoCard = () => {
  const t = useTranslations("festival");

  return (
    <Link
      href="/festival"
      className="relative flex h-52 w-full cursor-pointer items-end overflow-hidden rounded-md shadow-md sm:h-96 sm:rounded-2xl"
    >
      <Image
        className="absolute z-0"
        src="/cardBanner.JPG"
        alt="Person walking on a Highline"
        fill
        sizes="100vw"
        style={{
          objectFit: "cover",
          objectPosition: "center",
        }}
      />
      <BorderBeam className="z-50" duration={10} />
      <div className="relative w-full bg-gradient-to-t from-neutral-700 from-20% to-transparent p-2 pt-4 text-white sm:p-4 sm:pt-8">
        <p className="text-2xl font-bold sm:text-4xl">
          Festival Chooselife 2024
        </p>
        <p className="text-sm sm:text-base">{t("cardSubTitle")}</p>
      </div>
    </Link>
  );
};
