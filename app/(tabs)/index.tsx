import * as Location from "expo-location";
import { useState, useRef } from "react";
import { View } from "react-native";
import MapView, { type Region, type MapType } from "react-native-maps";
import type { BBox } from "geojson";

import ListingsBottomSheet from "~/components/map/bottom-sheet";
import MapControls from "~/components/map/controls";
import { calculateZoomLevel, regionToBoundingBox } from "~/utils";
import { MapCardList } from "~/components/map/map-card";

import { useHighline } from "~/hooks/useHighline";
import { Markers } from "~/components/map/markers";

// Constants
const INITIAL_REGION = {
  latitude: -15.7782081,
  longitude: -47.93371,
  latitudeDelta: 80,
  longitudeDelta: 80,
};

export default function Screen() {
  const mapRef = useRef<MapView>(null);
  const [isOnMyLocation, setIsOnMyLocation] = useState(false);
  const [mapType, setMapType] = useState<MapType>("standard");
  const [zoom, setZoom] = useState(10);
  const [bounds, setBounds] = useState<BBox>(
    regionToBoundingBox(INITIAL_REGION)
  );

  const {
    highlines,
    highlightedMarker,
    clusterMarkers,
    setHighlightedMarker,
    setClusterMarkers,
  } = useHighline();

  async function getMyLocation(): Promise<Region | undefined> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;

    const { latitude, longitude } = (await Location.getCurrentPositionAsync({}))
      .coords;
    const region = {
      latitude,
      longitude,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
    return region;
  }

  async function goToMyLocation() {
    const region = await getMyLocation();
    if (!region) return;
    mapRef.current?.animateToRegion(region, 1000);
    setIsOnMyLocation(true);
  }

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        showsUserLocation
        showsMyLocationButton={false}
        initialRegion={INITIAL_REGION}
        mapType={mapType}
        onMapReady={() => goToMyLocation()}
        onTouchMove={() => setIsOnMyLocation(false)}
        onRegionChangeComplete={async (region) => {
          const zoom = calculateZoomLevel(region.latitudeDelta);
          const bounds = regionToBoundingBox(region);
          setZoom(zoom);
          setBounds(bounds);
        }}
        onPress={() => {
          if (highlightedMarker) {
            setHighlightedMarker(null);
            setClusterMarkers(null);
          }
        }}
      >
        <Markers
          mapRef={mapRef}
          highlines={highlines}
          highlightedMarker={highlightedMarker}
          zoom={zoom}
          bounds={bounds}
          updateMarkers={(highlines, focused) => {
            setClusterMarkers(highlines);
            setHighlightedMarker(focused);
          }}
        />
      </MapView>
      <MapControls
        isOnMyLocation={isOnMyLocation}
        goToMyLocation={() => goToMyLocation()}
        mapType={mapType}
        setMapType={setMapType}
      />
      <ListingsBottomSheet highlines={highlines} />
      {clusterMarkers && clusterMarkers.length !== 0 && (
        <MapCardList
          highlines={clusterMarkers || []}
          focusedMarker={highlightedMarker}
          changeFocusedMarker={(high) => setHighlightedMarker(high)}
        />
      )}
    </View>
  );
}
