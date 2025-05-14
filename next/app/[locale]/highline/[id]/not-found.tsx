import Link from "next/link";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("highline.notFound");

  return (
    <div className="mx-auto max-w-screen-md">
      <section className="flex-1">
        <div className="mx-auto max-w-screen-xl px-4 py-8 lg:px-6 lg:py-16">
          <div className="mx-auto max-w-screen-sm text-center">
            <p className="mb-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl">
              {t("title")}
            </p>
            <div className="my-4 flex justify-center gap-4">
              <Link
                href={"/"}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 dark:border-gray-500 dark:bg-gray-800 dark:fill-gray-400 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-700"
              >
                {t("buttonLabel")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
