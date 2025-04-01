"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css";
import "leaflet-defaulticon-compatibility";
import "./leaflet-reset.css";

import type { Map } from "leaflet";
import React, { useRef, useState } from "react";
import { MapContainer } from "react-leaflet";

import { MapControls } from "./Controls";
import { LocationPicker } from "./LocationPicker";
import { Markers } from "./Markers";
import { Selected } from "./Selected";
import { UserLocationMarker } from "./UserLocationMarker";

const MapComponent: React.FC<{
  locale: string;
  isPickingLocation: boolean;
  focusedMarker: string | null;
}> = ({ locale, isPickingLocation, focusedMarker }) => {
  const mapRef = useRef<Map | null>(null);
  const [highlineIds, setHighlineIds] = useState<string[]>([]);

  return (
    <div
      className="fixed inset-0 w-full"
      id="leaflet-container"
      style={{ height: "100dvh" }}
    >
      <MapContainer
        center={[-15.7783994, -47.9308375]}
        zoom={12}
        maxZoom={18}
        minZoom={2}
        zoomControl={false}
        ref={mapRef}
        className="h-full w-full"
      >
        <LocationPicker
          isPicking={isPickingLocation}
          focusedMarker={focusedMarker}
        />
        {!isPickingLocation && (
          <Markers
            setHighlineIds={setHighlineIds}
            focusedMarker={focusedMarker}
          />
        )}
        <UserLocationMarker focusedMarker={focusedMarker} />
        <MapControls />
      </MapContainer>
      <Selected highlineIds={highlineIds} focusedMarker={focusedMarker} />
    </div>
  );
};

export default MapComponent;
