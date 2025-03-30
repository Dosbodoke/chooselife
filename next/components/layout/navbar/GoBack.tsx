"use client";

import { useTranslations } from "next-intl";

import { ArrowLongLeftIcon } from "@/assets";
import { Link, usePathname } from "@/navigation";

function GoBack() {
  const pathname = usePathname();
  const t = useTranslations();

  if (pathname === "/") return <span></span>;
  return (
    <Link href={"/"} className="flex gap-1">
      <ArrowLongLeftIcon className="inline-block h-6 w-6" />
      {t("goBack")}
    </Link>
  );
}

export default GoBack;
