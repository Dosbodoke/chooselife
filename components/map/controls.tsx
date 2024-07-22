import type React from "react";
import type { MapType } from "react-native-maps";

import { View, TouchableOpacity } from "react-native";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

import { Locate } from "~/lib/icons/Locate";
import { LocateFixed } from "~/lib/icons/Locate-fixed";
import { Map } from "~/lib/icons/Map";
import { Layers2 } from "~/lib/icons/Layers2";
import { Satellite } from "~/lib/icons/Satellite";
import { H4, P } from "~/components/ui/typography";
import { cn } from "~/lib/utils";

interface Props {
  mapType: MapType;
  isOnMyLocation: boolean;
  goToMyLocation: () => void;
  setMapType: React.Dispatch<React.SetStateAction<MapType>>;
}

const MapControls = ({
  mapType,
  isOnMyLocation,
  goToMyLocation,
  setMapType,
}: Props) => {
  return (
    <View className="absolute right-2 mb-3 top-16 rounded-md bg-card">
      <TouchableOpacity
        className="h-12 w-12 items-center justify-center"
        onPress={goToMyLocation}
      >
        {isOnMyLocation ? <LocateFixed /> : <Locate />}
      </TouchableOpacity>

      <View className="w-full h-px bg-muted"></View>

      <Popover>
        <PopoverTrigger asChild>
          <TouchableOpacity className="h-12 w-12 items-center justify-center">
            <Layers2 />
          </TouchableOpacity>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-popover/90 backdrop-blur-sm">
          <View className="flex gap-4">
            <View>
              <H4>Tipo do mapa</H4>
              <P>Escolher tipo do mapa</P>
            </View>

            <View className="flex flex-row gap-2">
              <TouchableOpacity
                onPress={() => setMapType("standard")}
                className={cn(
                  "flex flex-1 gap-6 rounded-md border-2 border-border p-4 hover:border-ring",
                  mapType === "standard" ? "bg-accent" : ""
                )}
              >
                <Map className="h-6 w-6" />
                <P>Mapa</P>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMapType("satellite")}
                className={cn(
                  "flex flex-1 gap-6 rounded-md border-2 border-border p-4 hover:border-ring",
                  mapType === "satellite" ? "bg-accent" : ""
                )}
              >
                <Satellite className="h-6 w-6" />
                <P>Satélite</P>
              </TouchableOpacity>
            </View>
          </View>
        </PopoverContent>
      </Popover>
    </View>
  );
};

export default MapControls;
