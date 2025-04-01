import { CrownIcon } from "lucide-react";
import React from "react";

function LoadingSkeleton() {
  return (
    <div className="mt-2">
      <div className="flex items-end justify-center gap-4">
        <div className="flex flex-grow flex-col items-center">
          <div className="flex w-full items-center justify-center border-4 border-b-4 border-t-0 border-transparent border-b-neutral-200 dark:border-b-neutral-600">
            <div className="flex w-[96%] animate-pulse flex-col items-center gap-3 bg-gradient-to-t from-neutral-300/20 to-80% py-4 dark:from-neutral-300/10">
              <div className="flex flex-col items-center gap-1">
                <CrownIcon className="mb-2 h-12 w-12 rounded-full text-2xl opacity-70 md:text-4xl" />
                <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
              <div className="flex w-full flex-col items-center gap-0.5">
                <div className="mb-1 h-4 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex w-full items-start justify-center bg-neutral-100 p-4 py-8 dark:bg-neutral-900/75">
            <div className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>
        <div className="flex flex-grow flex-col items-center">
          <div className="flex w-full items-center justify-center border-4 border-b-4 border-t-0 border-transparent border-b-neutral-200 dark:border-b-neutral-600">
            <div className="flex w-[96%] animate-pulse flex-col items-center gap-3 bg-gradient-to-t from-yellow-500/5 to-80% py-4 dark:from-yellow-500/10">
              <div className="flex flex-col items-center gap-1">
                <CrownIcon className="mb-2 h-12 w-12 rounded-full text-2xl opacity-70 md:text-4xl" />
                <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
              <div className="flex w-full flex-col items-center gap-0.5">
                <div className="mb-1 h-4 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex w-full items-start justify-center bg-neutral-100 p-4 py-8 dark:bg-neutral-900/75 md:p-6 md:py-12">
            <div className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>
        <div className="flex flex-grow flex-col items-center">
          <div className="flex w-full items-center justify-center border-4 border-b-4 border-t-0 border-transparent border-b-neutral-200 dark:border-b-neutral-600">
            <div className="flex w-[96%] animate-pulse flex-col items-center gap-3 bg-gradient-to-t from-amber-700/5 to-80% py-4 dark:from-amber-700/10">
              <div className="flex flex-col items-center gap-1">
                <CrownIcon className="mb-2 h-12 w-12 rounded-full text-2xl opacity-70 md:text-4xl" />
                <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
              <div className="flex w-full flex-col items-center gap-0.5">
                <div className="mb-1 h-4 w-24 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-16 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
          </div>
          <div className="flex w-full items-start justify-center bg-neutral-100 p-4 py-8 dark:bg-neutral-900/75">
            <div className="h-4 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>
      </div>
      <ul className="mt-4 animate-pulse divide-y divide-gray-200 dark:divide-gray-700">
        {[...Array(5)].map((_, index) => (
          <li key={index} className="flex items-center justify-between py-4">
            <div className="flex gap-2">
              <div className="h-10 w-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div className="h-4 w-32 rounded-full bg-gray-200 dark:bg-gray-700"></div>
            </div>
            <div className="h-4 w-12 rounded-full bg-gray-200 dark:bg-gray-700"></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default LoadingSkeleton;
