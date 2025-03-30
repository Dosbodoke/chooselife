"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/navigation";

function Footer() {
  const t = useTranslations("footer");
  return (
    <footer className="w-full py-8 text-base text-gray-900 opacity-75 transition hover:opacity-100 dark:text-gray-400">
      <div className="flex items-center justify-center">
        <p>Festival Chooselife</p>
        <div className="mx-2 h-4 w-0 border border-gray-700 dark:border-gray-300" />
        <p className="mr-2 text-base">2023</p>
      </div>
      <div className="text-center">
        {t("desc")}
        <Link
          href="https://www.instagram.com/juangsandrade/"
          target="_blank"
          className="text-blue-600 dark:text-blue-500"
        >
          Juan Andrade
        </Link>
      </div>
    </footer>
  );
}

export default Footer;
