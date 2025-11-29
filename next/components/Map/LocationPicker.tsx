"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import L, { type LatLng, type Marker as MarkerType } from "leaflet";
import { MapPin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import React, { useMemo, useRef, useState } from "react";
import ReactDOMServer from "react-dom/server";
import { Marker, Polyline, useMapEvent } from "react-leaflet";

import { CheckIcon } from "@/components/ui/check";
import { MapPinMinusInsideIcon } from "@/components/ui/map-pin-minus-inside";
import { MapPinPlusInsideIcon } from "@/components/ui/map-pin-plus-inside";
import { XIcon } from "@/components/ui/x";
import { useRouter } from "@/i18n/navigation";
import {
  encodeLocation,
  getDistance,
  locationToPostGISPoint,
} from "@/utils/helperFunctions";
import { supabaseBrowser } from "@/utils/supabase/client";

export const LocationPicker = ({
  focusedMarker,
  isPicking,
}: {
  focusedMarker: string | null;
  isPicking: boolean;
}) => {
  const queryClient = useQueryClient();
  const supabase = supabaseBrowser();
  const insertLocationMutation = useMutation<
    undefined,
    Error,
    { anchorA: LatLng; anchorB: LatLng }
  >({
    mutationFn: async (data) => {
      const { error } = await supabase
        .from("highline")
        .update({
          length: getDistance({ anchorA: data.anchorA, anchorB: data.anchorB }),
          anchor_a: locationToPostGISPoint({
            lat: data.anchorA.lat,
            lng: data.anchorA.lng,
          }),
          anchor_b: locationToPostGISPoint({
            lat: data.anchorB.lat,
            lng: data.anchorB.lng,
          }),
        })
        .eq("id", focusedMarker as string);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highline", focusedMarker] });
      router.push(`/${focusedMarker}`);
    },
  });
  const router = useRouter();
  const [_, setLocation] = useQueryState("location");

  const map = useMapEvent("move", () => {
    setCenter(map.getCenter());
  });

  const [center, setCenter] = useState<LatLng>(map.getCenter());
  const [anchorA, setAnchorA] = useState<LatLng | null>(null);
  const [anchorB, setAnchorB] = useState<LatLng | null>(null);
  const anchorARef = useRef<MarkerType | null>(null);
  const markerEventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = anchorARef.current;
        if (marker !== null) {
          setAnchorA(marker.getLatLng());
        }
      },
    }),
    []
  );

  const icon = new L.DivIcon({
    html: ReactDOMServer.renderToString(
      <MapPin className="absolute left-1/2 top-1/2 z-[1000] h-6 w-6 -translate-x-1/2 -translate-y-full fill-red-500 text-black" />
    ),
    iconSize: [24, 24],
  });

  let distance: number | null = null;
  if (anchorA && (anchorB || center)) {
    const latlng1 = L.latLng(anchorA.lat, anchorA.lng);
    const latlng2 = L.latLng(
      anchorB?.lat || center.lat,
      anchorB?.lng || center.lng
    );
    distance = getDistance({ anchorA: latlng1, anchorB: latlng2 });
  }

  function handlePickLocation() {
    const center = map.getCenter();
    if (!anchorA) {
      setAnchorA(center);
      return;
    }
    if (!anchorB) {
      setAnchorB(center);
      return;
    }

    if (focusedMarker) {
      insertLocationMutation.mutate({
        anchorA,
        anchorB,
      });
    } else {
      setLocation(encodeLocation(anchorA, anchorB));
    }
  }

  function handleUndoPickLocation() {
    if (anchorB) {
      setAnchorB(null);
      return;
    }
    if (anchorA) {
      setAnchorA(null);
      return;
    }
    setLocation(null);
  }

  return (
    <>
      <div className="absolute left-1/2 top-1/2 z-[1000] flex -translate-x-1/2 -translate-y-full flex-col items-center">
        <AnimatePresence>
          {isPicking && !(anchorA && anchorB) && distance ? (
            <motion.span
              key="distance"
              variants={markerVariants}
              initial="initial"
              animate="active"
              exit="exit"
              transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
              className="mb-1 rounded-2xl bg-slate-950 px-2 py-1 text-white"
            >
              {distance}m
            </motion.span>
          ) : null}
        </AnimatePresence>

        <AnimatePresence custom={anchorA && anchorB}>
          {isPicking && !(anchorA && anchorB) ? (
            <motion.div
              key="pin"
              variants={markerVariants}
              initial="initial"
              animate="active"
              exit="exit"
              transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
              custom={anchorA && anchorB}
            >
              <MapPin className="h-6 w-6 fill-red-500 text-black" />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {anchorA && (
        <Marker
          ref={anchorARef}
          draggable
          eventHandlers={markerEventHandlers}
          position={anchorA}
          icon={icon}
        />
      )}
      {anchorB && <Marker position={anchorB} icon={icon}></Marker>}
      {anchorA && (anchorB || center) ? (
        <Polyline
          positions={[anchorA, anchorB || center]}
          dashArray={[20, 10]}
          color="#000000"
        />
      ) : null}

      {isPicking ? (
        <PickerControls
          onPick={handlePickLocation}
          onUndo={handleUndoPickLocation}
          stage={anchorA ? (anchorB ? "final" : "partial") : "initial"}
        />
      ) : null}
    </>
  );
};

const PickerControls: React.FC<{
  onPick: () => void;
  onUndo: () => void;
  stage: "initial" | "partial" | "final";
}> = ({ onPick, onUndo, stage }) => {
  const t = useTranslations("map.locationPicker");

  const label = {
    initial: t("setA"),
    partial: t("setB"),
    final: t("confirm"),
  };

  return (
    <div className="pointer-events-none fixed bottom-3 left-1/2 z-[1000] flex w-full -translate-x-1/2 justify-center overflow-hidden">
      <motion.div
        initial={{ y: 25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 25, opacity: 0 }}
        transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
        className="pointer-events-auto flex w-fit overflow-hidden rounded-lg border border-slate-600 shadow-sm shadow-black/5 rtl:space-x-reverse"
      >
        <motion.button
          className="rounded-none border-r border-slate-600 bg-black p-1 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
          onClick={onUndo}
        >
          {stage === "initial" ? (
            <XIcon className="h-6 w-6 text-red-400" />
          ) : (
            <MapPinMinusInsideIcon className="h-6 w-6 text-red-400" />
          )}
        </motion.button>
        <motion.div className="grid items-center rounded-none border border-none bg-background bg-black p-1 px-3 text-base text-white shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={stage}
              initial={{ opacity: 0, y: -10, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 10, filter: "blur(2px)" }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
            >
              {label[stage]}
            </motion.span>
          </AnimatePresence>
        </motion.div>
        <motion.button
          className="rounded-none border-l border-slate-600 bg-black p-1 shadow-none first:rounded-s-lg last:rounded-e-lg focus-visible:z-10"
          onClick={onPick}
        >
          {stage === "final" ? (
            <CheckIcon className="h-6 w-6 text-green-400" />
          ) : (
            <MapPinPlusInsideIcon className="h-6 w-6 text-green-400" />
          )}
        </motion.button>
      </motion.div>
    </div>
  );
};

const markerVariants = {
  initial: { opacity: 0, y: -12 },
  active: { opacity: 1, y: 0 },
  exit: (skipAnimation: boolean) => {
    return skipAnimation ? { opacity: 0 } : { opacity: 0, y: -12 };
  },
};
