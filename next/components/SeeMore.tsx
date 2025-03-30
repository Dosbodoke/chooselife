"use client";

import { useTranslations } from "next-intl";

interface Props {
  onClick: () => void;
  disabled?: boolean;
}
function SeeMore({ onClick, disabled }: Props) {
  const t = useTranslations("highline.tabs");
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-2 cursor-pointer text-center text-sm font-medium text-blue-600 dark:text-blue-500"
    >
      {t("seeMore")}
    </button>
  );
}

export default SeeMore;
