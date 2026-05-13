import {
  formatUsernameForDisplay,
  normalizeUsernameInput,
} from "@chooselife/ui";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface Props {
  username: string;
  className?: string;
}
export const UsernameLink = ({ username, className }: Props) => {
  const normalizedUsername = normalizeUsernameInput(username);

  return (
    <Link
      href={`/profile/${normalizedUsername}`}
      className={cn(
        "truncate font-medium text-blue-700 dark:text-blue-500",
        className,
      )}
    >
      {formatUsernameForDisplay(normalizedUsername)}
    </Link>
  );
};
