import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";

interface Props {
  total_distance_walked: number;
  total_cadenas: number;
  total_full_lines: number;
}
function Stats({
  total_distance_walked,
  total_cadenas,
  total_full_lines,
}: Props) {
  const t = useTranslations("profile.stats");
  const displayDistanceInKM = total_distance_walked > 10000;

  return (
    <Card>
      <CardContent className="grid grid-cols-3 gap-3 divide-x divide-gray-200 px-2 py-4 sm:gap-8">
        <div className="flex flex-col items-center justify-center">
          <dt className="mb-2 text-3xl font-extrabold md:text-4xl">
            {displayDistanceInKM
              ? total_distance_walked / 1000
              : total_distance_walked}
            <span className="text-xl font-extrabold text-gray-500 dark:text-gray-400 md:text-2xl">
              {displayDistanceInKM ? "km" : "m"}
            </span>
          </dt>
          <dd className="font-light text-gray-500 dark:text-gray-400">
            {t("walked")}
          </dd>
        </div>
        <div className="flex flex-col items-center justify-center">
          <dt className="mb-2 text-3xl font-extrabold md:text-4xl">
            {total_cadenas}
          </dt>
          <dd className="font-light text-gray-500 dark:text-gray-400">
            {t("sent")}
          </dd>
        </div>
        <div className="flex flex-col items-center justify-center">
          <dt className="mb-2 text-3xl font-extrabold md:text-4xl">
            {total_full_lines}
          </dt>
          <dd className="font-light text-gray-500 dark:text-gray-400">
            {t("fullLines")}
          </dd>
        </div>
      </CardContent>
    </Card>
  );
}

export default Stats;
