import React from "react";

function loading() {
  return (
    <div className="relative mx-auto max-w-screen-md animate-pulse rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800">
      <div className="h-64 w-full rounded bg-gray-200 dark:bg-gray-700 lg:h-auto lg:w-1/2" />
      <div className="mb-6 w-full px-2 lg:mb-0 lg:w-1/2 lg:py-6 lg:pr-10">
        <h1 className="my-4 h-6 w-48 rounded-full bg-gray-200 dark:bg-gray-700"></h1>

        <div className="mb-2.5 h-2 max-w-[480px] rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="mb-2.5 h-2 max-w-[480px] rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="mb-2.5 h-2 max-w-[480px] rounded-full bg-gray-200 dark:bg-gray-700" />

        <div className="mt-6 flex items-center justify-between space-x-9 border-t border-gray-200 py-2">
          <div className="h-2 flex-grow-[2] rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="mt-2 flex items-center justify-between space-x-9 border-t border-gray-200 py-2">
          <div className="h-2 flex-grow-[2] rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="mt-2 flex items-center justify-between space-x-9 border-t border-gray-200 py-2">
          <div className="h-2 flex-grow-[2] rounded-full bg-gray-200 dark:bg-gray-700" />
          <div className="h-2 flex-1 rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

export default loading;
