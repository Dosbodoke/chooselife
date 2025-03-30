"use client";

import { MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { RegistryEntry } from "@/app/[locale]/[id]/_components/RegistryEntry";
import type { Highline } from "@/app/actions/getHighline";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Link } from "@/navigation";

export const HighlineHeader = ({ highline }: { highline: Highline }) => {
  const t = useTranslations("highline.header");

  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (descriptionRef.current) {
      const isClamped =
        descriptionRef.current.scrollHeight >
        descriptionRef.current.clientHeight;
      setIsClamped(isClamped);
    }
  }, [descriptionRef]);

  return (
    <CardHeader className="space-y-4 pb-3">
      <div>
        <CardTitle className="text-xl">{highline.name}</CardTitle>
        {highline.description ? (
          <div className="relative">
            <CardDescription
              data-expanded={descriptionExpanded}
              className="line-clamp-3 data-[expanded=true]:line-clamp-none"
              ref={descriptionRef}
            >
              {highline.description}
            </CardDescription>
            <Button
              className={cn(
                "hidden w-fit -translate-y-2 p-0 text-blue-700 dark:text-blue-500",
                isClamped ? "block" : ""
              )}
              onClick={() => setDescriptionExpanded((prev) => !prev)}
              variant="link"
            >
              {descriptionExpanded
                ? t("shrinkDescription")
                : t("expandDescription")}
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2">
        <RegistryEntry
          highlineId={highline.id}
          highlineDistance={highline.length}
        />
        <Button variant="outline" className="border-dashed" asChild>
          {highline.anchor_a_lat && highline.anchor_b_lat ? (
            <Link href={`/?view=map&focusedMarker=${highline.id}`}>
              <MapPinIcon className="mr-2 h-4 w-4" /> {t("seeOnMap")}
            </Link>
          ) : (
            <Link
              href={`/?view=map&focusedMarker=${highline.id}&location=picking`}
            >
              <MapPinIcon className="mr-2 h-4 w-4" /> {t("addToMap")}
            </Link>
          )}
        </Button>
      </div>
    </CardHeader>
  );
};
