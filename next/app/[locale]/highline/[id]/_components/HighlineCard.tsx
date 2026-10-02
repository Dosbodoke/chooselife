import { Highline } from "@/app/actions/getHighline";
import { FavoriteHighline } from "@/components/FavoriteHighline";
import HighlineImage from "@/components/HighlineImage";
import { Card, CardContent } from "@/components/ui/card";

import { HighlineTabs } from "./highline-tabs";
import { HighlineHeader } from "./HighlineHeader";

function HighlineCard({ highline }: { highline: Highline }) {
  return (
    <Card className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden">
      <div className="relative h-72 w-full sm:h-96">
        <HighlineImage coverImageId={highline.cover_image} />
        <FavoriteHighline id={highline.id} isFavorite={highline.is_favorite} />
      </div>
      {/* Content sheet over the cover, like the app */}
      <div className="relative -mt-6 rounded-t-3xl bg-card">
        <HighlineHeader highline={highline} />
        <CardContent>
          <HighlineTabs highline={highline} />
        </CardContent>
      </div>
    </Card>
  );
}

export default HighlineCard;
