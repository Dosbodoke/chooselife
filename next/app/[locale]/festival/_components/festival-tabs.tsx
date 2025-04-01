import React from "react";

import { getHighline } from "@/app/actions/getHighline";
import { Ranking } from "@/components/Ranking";
import { TabsContent } from "@/components/ui/tabs";
import { useSupabaseServer } from "@/utils/supabase/server";

import { Highline } from "../../_components/Highline";

export const FestivalTabs = async () => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const supabase = await useSupabaseServer();

  const { data: sectors } = await supabase
    .from("sector")
    .select("*, highline(id)");

  const highline_ids = sectors?.flatMap((sector) =>
    sector.highline.map((high) => high.id)
  );

  const { data: highlines } = await getHighline({
    id: sectors?.flatMap((sector) => sector.highline.map((high) => high.id)),
  });

  return (
    <>
      <TabsContent className="mt-4" value="ranking">
        <Ranking
          highlines_ids={highline_ids || []}
          visibleCategories={["cadenas", "distance", "fullLine"]}
          startDate={new Date("2024-05-30")}
          endDate={new Date("2024-06-07")}
        />
      </TabsContent>
      <TabsContent className="mt-4" value="highlines">
        {sectors?.map((sector) => (
          <section key={sector.id}>
            <h2 className="mt-4 text-2xl font-bold">{sector.name}</h2>
            <div className="flex gap-8 overflow-x-auto">
              {sector.highline.map((high) => {
                const highline = highlines?.find((h) => h.id === high.id);
                return highline ? (
                  <Highline
                    key={highline.id}
                    highline={highline}
                    classname="flex-grow-0 flex-shrink-0 flex max-w-[18rem]"
                  />
                ) : null;
              })}
            </div>
          </section>
        ))}
      </TabsContent>
    </>
  );
};
