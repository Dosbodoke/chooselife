import HighlineImage from "@/components/HighlineImage";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

// Mirrors the geometry of <Highline /> so cards keep their size when data loads.
export function HighlineListSkeleton({ count }: { count: number }) {
  return (
    <>
      {Array.from(Array(count)).map((_, idx) => (
        <Card
          aria-hidden
          className="flex w-full max-w-[22rem] animate-pulse flex-col overflow-hidden"
          key={`high-skeleton-${idx}`}
        >
          <div className="relative h-48 w-full opacity-25">
            <HighlineImage coverImageId={null} />
          </div>
          <CardHeader className="space-y-1 pb-3">
            <div className="h-5 w-40 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="mt-2 h-5 w-28 rounded-lg bg-gray-200 dark:bg-gray-700" />
          </CardHeader>
          <CardContent className="mb-6 space-y-2 pb-0">
            <div className="h-3 w-full rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="h-3 w-3/4 rounded-lg bg-gray-200 dark:bg-gray-700" />
          </CardContent>
          <CardFooter className="mt-auto">
            <div className="h-9 w-full rounded-md bg-gray-200 dark:bg-gray-700" />
          </CardFooter>
        </Card>
      ))}
    </>
  );
}
