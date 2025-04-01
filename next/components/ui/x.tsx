"use client";

import type { Variants } from "motion/react";
import { motion, useAnimation } from "motion/react";

const pathVariants: Variants = {
  normal: {
    opacity: 1,
    pathLength: 1,
  },
  animate: {
    opacity: [0, 1],
    pathLength: [0, 1],
  },
};

const XIcon = ({ className }: { className: string }) => {
  const controls = useAnimation();

  return (
    <div
      className="flex cursor-pointer select-none items-center justify-center rounded-md p-2"
      onMouseEnter={() => controls.start("animate")}
      onMouseLeave={() => controls.start("normal")}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <motion.path
          variants={pathVariants}
          animate={controls}
          d="M18 6 6 18"
        />
        <motion.path
          transition={{ delay: 0.2 }}
          variants={pathVariants}
          animate={controls}
          d="m6 6 12 12"
        />
      </svg>
    </div>
  );
};

export { XIcon };
