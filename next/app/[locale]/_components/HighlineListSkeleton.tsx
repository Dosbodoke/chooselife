import HighlineImage from "@/components/HighlineImage";

export function HighlineListSkeleton() {
  return (
    <>
      {Array.from(Array(8)).map((_, idx) => (
        <div
          className="flex w-full max-w-[24rem] animate-pulse flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow dark:border-gray-700 dark:bg-gray-800 md:w-96"
          key={`high-skeleton-${idx}`}
        >
          <div className="relative block h-72 w-full opacity-25">
            <HighlineImage coverImageId={null} />
          </div>
          <div className="p-5">
            <div className="mt-4 h-6 w-28 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-3 w-full rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-3 w-56 rounded-lg bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      ))}
    </>
  );
}
