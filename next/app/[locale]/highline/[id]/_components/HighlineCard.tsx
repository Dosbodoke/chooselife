import { Highline } from "@/app/actions/getHighline";
import HighlineImage from "@/components/HighlineImage";
import { Card, CardContent } from "@/components/ui/card";

import { FavoriteHighline } from "../../_components/FavoriteHighline";
import { HighlineTabs } from "./highline-tabs";
import { HighlineHeader } from "./HighlineHeader";

function HighlineCard({ highline }: { highline: Highline }) {
  return (
    <Card className="mx-auto flex w-full max-w-4xl flex-col overflow-hidden">
      <div className="relative h-48 w-full">
        <HighlineImage coverImageId={highline.cover_image} />
        <FavoriteHighline id={highline.id} isFavorite={highline.is_favorite} />
      </div>
      <HighlineHeader highline={highline} />
      <CardContent>
        <HighlineTabs highline={highline} />
      </CardContent>
    </Card>
  );
}

export default HighlineCard;
