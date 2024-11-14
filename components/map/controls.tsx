import type React from "react";
import type { MapType } from "react-native-maps";

import { View, TouchableOpacity } from "react-native";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

import { LucideIcon } from "~/lib/icons/lucide-icon";
import { H4, P } from "~/components/ui/typography";
import { cn } from "~/lib/utils";

const MapControls: React.FC<{
  mapType: MapType;
  isOnMyLocation: boolean;
  goToMyLocation: () => void;
  setMapType: React.Dispatch<React.SetStateAction<MapType>>;
}> = ({ mapType, isOnMyLocation, goToMyLocation, setMapType }) => {
  return (
    <View className="absolute right-2 top-6 rounded-md bg-card">
      <TouchableOpacity
        className="h-12 w-12 items-center justify-center"
        onPress={goToMyLocation}
      >
        {isOnMyLocation ? (
          <LucideIcon
            name="LocateFixed"
            className="w-6 h-6 text-black"
            strokeWidth={2}
          />
        ) : (
          <LucideIcon
            name="Locate"
            className="w-6 h-6 text-black"
            strokeWidth={2}
          />
        )}
      </TouchableOpacity>

      <View className="w-full h-px bg-muted"></View>

      <Popover>
        <PopoverTrigger asChild>
          <TouchableOpacity className="h-12 w-12 items-center justify-center">
            <LucideIcon
              name="Layers2"
              className="w-6 h-6 text-black"
              strokeWidth={2}
            />
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
                <LucideIcon
                  name="Map"
                  className="w-6 h-6 text-black"
                  strokeWidth={2}
                />
                <P>Mapa</P>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setMapType("satellite")}
                className={cn(
                  "flex flex-1 gap-6 rounded-md border-2 border-border p-4 hover:border-ring",
                  mapType === "satellite" ? "bg-accent" : ""
                )}
              >
                <LucideIcon
                  name="Satellite"
                  className="w-6 h-6 text-black"
                  strokeWidth={2}
                />
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
