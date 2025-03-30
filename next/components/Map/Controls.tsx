"use client";

import {
  Layers2Icon,
  LocateFixedIcon,
  LocateIcon,
  MapIcon,
  SatelliteIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { TileLayer, useMapEvents } from "react-leaflet";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const MapControls = () => {
  const t = useTranslations("map.type");
  const [mapType, setMapType] = useQueryState("mapType");

  const acceptedTypes = ["map", "satelite"] as const;
  const currentMapType: (typeof acceptedTypes)[number] = acceptedTypes.includes(
    mapType as (typeof acceptedTypes)[number]
  )
    ? (mapType as (typeof acceptedTypes)[number])
    : "map";
  const [isLocated, setIsLocated] = useState(false);

  const map = useMapEvents({
    locationfound: (e) => {
      map.flyTo(e.latlng, map.getZoom());
      setIsLocated(true);
    },
    movestart: (e) => {
      if (isLocated) setIsLocated(false);
    },
  });

  return (
    <>
      {currentMapType === "satelite" ? (
        <TileLayer
          attribution={`© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>`}
          url={`https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
        />
      ) : (
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.mapbox.com/">Mapbox</a>'
          url={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/tiles/{z}/{x}/{y}?access_token=${process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}`}
          maxZoom={20}
        />
      )}

      <div className="absolute right-2 top-2 z-[1000] flex flex-col divide-y divide-muted-foreground overflow-hidden rounded-md border border-input bg-background">
        <button
          className="grid h-9 w-9 place-items-center bg-transparent hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          disabled={isLocated}
          onClick={() => {
            map.locate();
          }}
        >
          {isLocated ? <LocateFixedIcon /> : <LocateIcon />}
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button className="grid h-9 w-9 place-items-center bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground">
              <Layers2Icon />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">{t("header")}</h4>
                <p className="text-sm text-muted-foreground">
                  {t("description")}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setMapType("map")}
                  data-active={currentMapType === "map"}
                  className="flex flex-1 flex-col gap-6 rounded-md border-2 border-border p-4 hover:border-ring data-[active=true]:bg-accent"
                >
                  <div className="h-6 w-6">
                    <MapIcon />
                  </div>
                  <div>{t("map")}</div>
                </button>
                <button
                  onClick={() => setMapType("satelite")}
                  data-active={currentMapType === "satelite"}
                  className="flex flex-1 flex-col gap-6 rounded-md border-2 border-border p-4 hover:border-ring data-[active=true]:bg-accent"
                >
                  <div className="h-6 w-6">
                    <SatelliteIcon />
                  </div>
                  <div>{t("satellite")}</div>
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
};
