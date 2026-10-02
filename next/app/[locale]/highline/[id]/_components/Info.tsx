"use client";

import { SupabaseProvider } from "@chooselife/ui";
import { useTranslations } from "next-intl";

import type { Highline } from "@/app/actions/getHighline";
import { supabaseBrowser } from "@/utils/supabase/client";

import { LocationWeatherCard } from "./location-weather-card";
import { RigHistory } from "./rig-history";

interface Props {
  highline: Highline;
}

function Info({ highline }: Props) {
  return (
    <SupabaseProvider supabase={supabaseBrowser()}>
      <div className="space-y-6">
        <HighlineDimensions height={highline.height} length={highline.length} />
        <LocationWeatherCard highline={highline} />
        <RigHistory highlineId={highline.id} />
      </div>
    </SupabaseProvider>
  );
}

function HighlineDimensions({
  height,
  length,
}: {
  height: number;
  length: number;
}) {
  const t = useTranslations("highline.tabs.informations");

  return (
    <div className="flex items-center justify-evenly rounded-2xl border bg-card p-5">
      <Dimension value={height} label={t("height")} />
      <div className="h-12 w-px bg-border" />
      <Dimension value={length} label={t("length")} />
    </div>
  );
}

function Dimension({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="flex items-baseline">
        <span className="text-4xl font-bold">{value}</span>
        <span className="ml-0.5 text-xl font-semibold text-muted-foreground">
          m
        </span>
      </p>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

export default Info;
