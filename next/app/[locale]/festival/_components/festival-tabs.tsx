"use client";

import { SupabaseProvider, useFestivalSchedule } from "@chooselife/ui";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Ranking } from "@/components/Ranking";
import { TabsContent } from "@/components/ui/tabs";
import { supabaseBrowser } from "@/utils/supabase/client";

import { FestivalHighlineCard } from "./festival-highline-card";

type Props = {
  festivalSlug: string;
  userId?: string;
};

export function FestivalTabs({ festivalSlug, userId }: Props) {
  return (
    <SupabaseProvider supabase={supabaseBrowser()} userId={userId}>
      <FestivalTabsContent festivalSlug={festivalSlug} />
    </SupabaseProvider>
  );
}

function FestivalTabsContent({ festivalSlug }: Props) {
  const t = useTranslations("festival");
  const scheduleQuery = useFestivalSchedule({
    festivalSlug,
  });

  const data = scheduleQuery.data;

  if (!data) {
    return (
      <div className="mt-12 grid w-full place-items-center">
        <Loader2 className="h-20 w-20 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <TabsContent className="mt-4" value="ranking">
        <Ranking
          highlines_ids={data.highlineIds}
          visibleCategories={["cadenas", "distance", "fullLine"]}
          startDate={new Date(data.festival.start_at)}
          endDate={new Date(data.festival.end_at)}
        />
      </TabsContent>

      <TabsContent className="mt-4 space-y-8" value="highlines">
        {scheduleQuery.isFetching ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("schedule.loading")}
          </div>
        ) : null}

        {data.sectors.map((group, index) => (
          <section key={group.sector?.id ?? `ungrouped-${index}`} className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">
                {group.sector?.name ?? t("schedule.defaultSector")}
              </h2>
              {group.sector?.description ? (
                <p className="max-w-2xl text-sm text-muted-foreground">
                  {group.sector.description}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-1 justify-items-center gap-4 md:grid-cols-2 lg:grid-cols-3">
              {group.cards.map((card) => (
                <FestivalHighlineCard
                  key={card.highline.id}
                  card={card}
                  festivalSlug={festivalSlug}
                  festivalTimeZone={data.festival.timezone}
                  viewerCanManage={data.viewer.canManage}
                  viewerUserId={data.viewer.userId}
                />
              ))}
            </div>
          </section>
        ))}
      </TabsContent>
    </>
  );
}
