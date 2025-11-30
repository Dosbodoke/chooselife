"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

export const QrCodeBadge = () => {
  const locale = useLocale();
  const [isShrunk, setIsShrunk] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsShrunk(window.scrollY > 100);
    };

    // Initial check
    handleScroll();

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!mounted) return null;

  const origin = window.location.origin;
  const downloadUrl = `${origin}/${locale}/download`;

  return (
    <motion.div
      layout
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="fixed right-0 top-1/2 z-50 hidden overflow-hidden rounded-l-xl border border-r-0 border-border bg-background shadow-xl md:block"
      style={{ y: "-50%" }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isShrunk ? (
          <motion.div
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex cursor-pointer items-center justify-center py-4 pl-3 pr-2 hover:bg-muted/50"
            onClick={() => setIsShrunk(false)}
          >
            <span className="whitespace-nowrap py-2 text-xs font-bold uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
              Download APP
            </span>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-3 p-4"
          >
            <div className="overflow-hidden rounded-lg bg-white p-2 shadow-sm">
              <QRCode value={downloadUrl} size={96} level="H" />
            </div>
            <span className="max-w-[120px] text-center text-xs font-medium text-muted-foreground">
              Scan to download the app
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
