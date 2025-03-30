import { CalendarFoldIcon, MapPinIcon, UserRoundIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import type { Tables } from "@/utils/supabase/database.types";

interface Props {
  profile: Tables<"profiles"> | null;
  username: string;
}

function UserHeader({ profile, username }: Props) {
  const t = useTranslations("profile.header");

  function calculateAge(birthday: string) {
    const birthdate = new Date(birthday);
    const today = new Date();

    // Get the difference between today and the user's birthdate
    let age = today.getFullYear() - birthdate.getFullYear();

    // Check if the current month is before the user's birth month,
    // or if it is their birth month but today is earlier than their actual birthday
    if (
      today.getMonth() < birthdate.getMonth() ||
      (today.getMonth() == birthdate.getMonth() &&
        today.getDate() < birthdate.getDate())
    ) {
      age--;
    }

    return age;
  }

  if (!profile) {
    return (
      <Card>
        <CardContent className="flex gap-4 space-y-2 overflow-hidden px-2 py-4">
          <Image
            src={"/default-profile-picture.png"}
            width={128}
            height={128}
            alt="Profile picture"
          />
          <div className="space-y-3">
            <h1 className="text-xl font-semibold">@{username}</h1>
            <div className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-500 dark:bg-red-100 dark:text-red-700 md:p-4">
              {t("notVerified")}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-2 overflow-hidden px-2 py-4">
        <div className="flex gap-4">
          <div className="relative h-24 w-24 sm:h-32 sm:w-32">
            <Image
              src={profile.profile_picture || "/default-profile-picture.png"}
              fill={true}
              alt="Profile picture"
              className="rounded-full"
            />
          </div>

          <div className="mt-4 flex-1">
            <h1 className="flex-1 text-xl font-semibold">{profile.name}</h1>
            <p className="text-muted-foreground">@{username}</p>
            <ul className="space-y-2">
              {profile.birthday ? (
                <li className="flex items-center gap-1 text-muted-foreground">
                  <CalendarFoldIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{t("age")}:</span> {calculateAge(profile.birthday)}
                </li>
              ) : null}
              {/* <li className="flex gap-2 text-muted-foreground">
                <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                location: Brasilia
              </li>
              <li className="flex gap-2 text-muted-foreground">
                <UserRoundIcon className="h-4 w-4 text-muted-foreground" />
                gender: male
              </li> */}
            </ul>
          </div>
        </div>
        <div>
          <p>{profile.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default UserHeader;
