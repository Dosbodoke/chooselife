import { cva } from "class-variance-authority";
import { CrownIcon } from "lucide-react";
import Image from "next/image";
import React from "react";

import { cn } from "@/lib/utils";
import { Link } from "@/navigation";

import { UsernameLink } from "./UsernameLink";

interface PodiumProps {
  username: string;
  value: string;
  position: number;
  profilePicture?: string;
}

const podiumVariants = cva("", {
  variants: {
    size: {
      small: "p-4 md:p-6",
      large: "md:p-6 md:py-12 p-4 py-8",
    },
    text: {
      gold: "text-yellow-500",
      silver: "text-neutral-500 dark:text-neutral-300",
      bronze: "text-amber-700",
    },
    gradient: {
      gold: "from-yellow-500/5 dark:from-yellow-500/10",
      silver: "from-neutral-300/20 dark:from-neutral-300/10",
      bronze: "from-amber-700/5 dark:from-amber-700/10",
    },
  },
});

const RankingPosition = ({ position }: { position: number }) => (
  <div className="flex items-center justify-center gap-1">
    <span className="xs:text-sm text-xs text-neutral-400 dark:text-neutral-600 md:text-lg">
      #
    </span>
    <span className="xs:text-base text-sm font-semibold text-neutral-800 dark:text-neutral-50 md:text-2xl">
      {position}
    </span>
  </div>
);

const ProfilePicture = ({
  username,
  src,
}: {
  username?: string;
  src?: string;
}) => {
  return (
    <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-neutral-200/40 dark:bg-neutral-800/60 md:h-16 md:w-16">
      {username ? (
        <Image
          src={src || "/default-profile-picture.png"}
          fill={true}
          alt="Profile picture"
          className="rounded-full"
        />
      ) : null}
    </div>
  );
};

const Podium = ({ username, value, position, profilePicture }: PodiumProps) => {
  const variant =
    position === 1 ? "gold" : position === 2 ? "silver" : "bronze";

  return (
    <Link
      href={`/profile/${username.replace("@", "")}`}
      className={`w-1/3 ${username ? "cursor-pointer" : "pointer-events-none"}`}
    >
      <div className="flex flex-col items-center md:min-w-[12rem]">
        <div className="flex w-full items-center justify-center border-4 border-b-4 border-t-0 border-transparent border-b-neutral-200 dark:border-b-neutral-600">
          <div
            className={cn(
              "flex w-[96%] flex-col items-center gap-3 bg-gradient-to-t to-80% py-4",
              podiumVariants({
                gradient: variant,
              })
            )}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-8 w-8 items-center justify-center md:h-12 md:w-12">
                <CrownIcon
                  className={cn(
                    "text-2xl md:text-4xl",
                    podiumVariants({ text: variant })
                  )}
                />
              </div>
              <ProfilePicture username={username} src={profilePicture} />
            </div>
            <div className="flex w-full flex-col items-center gap-0.5 md:gap-0">
              <span className="xs:text-sm max-w-[calc(100%-1rem)] overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal text-neutral-800 dark:text-neutral-50 md:text-lg">
                {username}
              </span>
              <div className="flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "text-xs md:text-base",
                    podiumVariants({ text: variant })
                  )}
                >
                  <span className="whitespace-nowrap">{value}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "xs:rounded-b-md flex w-full items-start justify-center bg-neutral-100 dark:bg-neutral-900/75",
            podiumVariants({
              size: variant === "gold" ? "large" : "small",
            })
          )}
        >
          <RankingPosition position={position} />
        </div>
      </div>
    </Link>
  );
};

export const LeaderboardRow = ({
  username,
  value,
  position,
  profilePicture,
}: PodiumProps) => {
  return (
    <li className="py-3 sm:py-4">
      <div className="flex space-x-4">
        <RankingPosition position={position} />
        <ProfilePicture username={username} src={profilePicture} />
        <div className="min-w-0 flex-1">
          <UsernameLink username={username} />
        </div>
        <div className="text-base font-medium text-gray-900 dark:text-white">
          {value}
        </div>
      </div>
    </li>
  );
};

interface LeaderboardProps {
  entries: Array<{
    name: string;
    value: string;
    position: number;
    profilePicture: string;
  } | null>;
}

export const Leaderboard = ({ entries }: LeaderboardProps) => {
  return (
    <>
      <div className="xs:gap-2 bg-light-theme-dotted-pattern dark:bg-dark-theme-dotted-pattern bg-dotted-pattern-size flex items-end justify-center gap-0 border-t border-t-neutral-100 bg-center bg-repeat dark:border-t-neutral-700/75 md:gap-4">
        <Podium
          username={entries[1]?.name || ""}
          value={entries[1]?.value || ""}
          position={2}
          profilePicture={entries[1]?.profilePicture}
        />
        <Podium
          username={entries[0]?.name || ""}
          value={entries[0]?.value || ""}
          position={1}
          profilePicture={entries[0]?.profilePicture}
        />
        <Podium
          username={entries[2]?.name || ""}
          value={entries[2]?.value || ""}
          position={3}
          profilePicture={entries[2]?.profilePicture}
        />
      </div>
      <ul className="divide-y divide-gray-200 dark:divide-gray-700">
        {entries
          .slice(3)
          .map((entry) =>
            entry ? (
              <LeaderboardRow
                key={`entry-${entry.position}`}
                username={entry.name}
                position={entry.position}
                value={entry.value}
                profilePicture={entry.profilePicture}
              />
            ) : null
          )}
      </ul>
    </>
  );
};
