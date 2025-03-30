"use client";

import { AvatarIcon, ExitIcon } from "@radix-ui/react-icons";
import { User } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/navigation";
import useSupabaseBrowser from "@/utils/supabase/client";

export default function ProfileMenu({ user }: { user: User }) {
  const supabase = useSupabaseBrowser();
  const t = useTranslations("profileMenu");
  const router = useRouter();

  const username: string = user.user_metadata["username"] || "";

  const signOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <AvatarIcon className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{username}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/profile/${username.replace("@", "")}`}>
              {t("myProfile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={signOut}>
            {t("signOut")} <ExitIcon className="ml-auto" />
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
