import { cn } from "@/lib/utils";
import React from "react";

import { FileTextIcon } from "lucide-react";
import Link from "next/link";

interface ArticleLinkProps {
  href: string;
  title: string;
  description?: string;
  date?: string | number;
  author?: string;
  className?: string;
}

export const ArticleLink: React.FC<ArticleLinkProps> = ({
  href,
  title,
  description,
  date,
  author,
  className,
}) => {
  return (
    <Link
      className={cn(
        "flex gap-4 rounded-xl p-3",
        "border border-border transition-colors hover:bg-muted",
        className
      )}
      href={href}
      target="_blank"
    >
      <div className="h-4 w-4 items-center">
        <FileTextIcon />
      </div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-gray-950 dark:text-white">
            {title}
          </span>
          {date && (
            <time className="text-xs text-gray-500 dark:text-gray-400">
              {date}
            </time>
          )}
        </div>

        {author && (
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            Por {author}
          </p>
        )}

        {description && (
          <p className="text-gray-700 dark:text-gray-400">{description}</p>
        )}
      </div>
    </Link>
  );
};
