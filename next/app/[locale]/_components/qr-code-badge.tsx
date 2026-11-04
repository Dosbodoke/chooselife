"use client";

import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

const easeOut = [0.23, 1, 0.32, 1] as const;

const contentHidden = { opacity: 0, scale: 0.96 };
const contentShown = {
  opacity: 1,
  scale: 1,
  transition: { duration: 0.2, ease: easeOut },
};
const contentExit = {
  opacity: 0,
  scale: 0.96,
  transition: { duration: 0.12, ease: easeOut },
};

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
    <MotionConfig reducedMotion="user">
      <div className="pointer-events-none fixed inset-y-0 right-0 z-50 hidden items-center md:flex">
        <motion.div
          layout
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="pointer-events-auto overflow-hidden border border-r-0 border-border bg-background shadow-xl"
          style={{ borderTopLeftRadius: 12, borderBottomLeftRadius: 12 }}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {isShrunk ? (
              <motion.button
                key="collapsed"
                type="button"
                layout="position"
                initial={contentHidden}
                animate={contentShown}
                exit={contentExit}
                className="group flex cursor-pointer items-center justify-center py-4 pl-3 pr-2 hover:bg-muted/50"
                onClick={() => setIsShrunk(false)}
              >
                <span className="whitespace-nowrap py-2 text-xs font-bold uppercase tracking-widest transition-transform duration-150 ease-out [writing-mode:vertical-rl] rotate-180 group-active:scale-[0.97] motion-reduce:group-active:scale-100">
                  Download APP
                </span>
              </motion.button>
            ) : (
              <motion.div
                key="expanded"
                layout="position"
                initial={contentHidden}
                animate={contentShown}
                exit={contentExit}
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
      </div>
    </MotionConfig>
  );
};
