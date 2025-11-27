import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

interface Props {
  username: string;
  className?: string;
}
export const UsernameLink = ({ username, className }: Props) => {
  return (
    <Link
      href={`/profile/${username.replace("@", "")}`}
      className={cn(
        "truncate font-medium text-blue-700 dark:text-blue-500",
        className
      )}
    >
      {username}
    </Link>
  );
};
