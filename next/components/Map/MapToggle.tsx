"use client";

import { ListIcon, MapIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

function MapToggle({ mapIsOpen }: { mapIsOpen: boolean }) {
  const t = useTranslations("map.toggle");
  const [_, setView] = useQueryState("view");

  const currentType = mapIsOpen ? "list" : "map";

  return (
    <div className="fixed bottom-3 left-1/2 z-50 flex w-fit -translate-x-1/2 justify-center">
      <motion.button
        onClick={() => setView(mapIsOpen ? "list" : "map")}
        initial={{ y: 25, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 25, opacity: 0 }}
        transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
        className="flex items-center gap-2 overflow-hidden rounded-3xl bg-black px-5 py-3 text-white"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={`label-${currentType}`}
            variants={toggleVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          >
            {t(currentType)}
          </motion.span>
          <motion.div
            key={`icon-${currentType}`}
            variants={toggleVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: "spring", bounce: 0, duration: 0.2 }}
            className="h-6 w-6"
          >
            {mapIsOpen ? <ListIcon /> : <MapIcon />}
          </motion.div>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

const toggleVariants = {
  initial: { opacity: 0, y: -10, filter: "blur(2px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: 10, filter: "blur(2px)" },
};

export default MapToggle;
