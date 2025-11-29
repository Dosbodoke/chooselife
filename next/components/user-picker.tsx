"use client";

import { useQuery } from "@tanstack/react-query";
import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheckIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounceValue } from "@/hooks/use-debounce-value";
import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/utils/supabase/client";
import { Tables } from "@/utils/supabase/database.types";

interface UserOption {
  username: string;
  verified: boolean;
  id?: string;
  name?: string;
  profile_picture?: string;
}

const userPickerVariants = cva(
  "gap-2 m-1 transition ease-in-out delay-150 hover:-translate-y-1 hover:scale-110 duration-300",
  {
    variants: {
      variant: {
        default:
          "border-foreground/10 drop-shadow-md text-foreground bg-card hover:bg-card/80",
        secondary:
          "border-foreground/10 bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        inverted: "inverted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface UserPickerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof userPickerVariants> {
  asChild?: boolean;
  defaultValue?: string[];
  disabled?: boolean;
  placeholder: string;
  className?: string;
  onValueChange: (value: string[], userIds: string[]) => void;
  minSelection?: number;
  maxSelection?: number;
  canPicknNonUser?: boolean;
}

export const UserPicker: React.FC<UserPickerProps> = ({
  className,
  variant,
  asChild = false,
  defaultValue = [],
  onValueChange,
  disabled,
  placeholder,
  minSelection = 0,
  maxSelection,
  canPicknNonUser = false,
  ...props
}) => {
  const onValueChangeRef = React.useRef(onValueChange);
  onValueChangeRef.current = onValueChange; // Update ref on every render
  const supabase = supabaseBrowser();
  const t = useTranslations("userPicker");
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounceValue(search);
  const normalizedSearch = React.useMemo(
    () => (!search || search.startsWith("@") ? search : `@${search}`),
    [search]
  );

  const { data: profiles, isPending } = useQuery({
    queryKey: ["profiles", { username: debouncedSearch }],
    queryFn: async () => {
      const query = supabase.from("profiles").select("*").neq("name", null);

      if (debouncedSearch) {
        query.ilike("username", `%${debouncedSearch}%`);
      } else {
        query.limit(5);
      }
      const response = await query;
      return response.data;
    },
  });

  const [selectedOptions, setSelectedOptions] = React.useState<UserOption[]>(
    () => {
      return defaultValue.map((username) => ({
        username,
        verified: false,
        id: undefined,
      }));
    }
  );

  const unselectedProfiles = React.useMemo(() => {
    if (!profiles) return [];

    const selectedUsernames = new Set(
      selectedOptions.map((option) => option.username)
    );

    return profiles.filter(
      (profile) => profile.username && !selectedUsernames.has(profile.username)
    );
  }, [profiles, selectedOptions]);

  const canSelectMore = React.useMemo(() => {
    if (!maxSelection) return true;
    return selectedOptions.length < maxSelection;
  }, [selectedOptions.length, maxSelection]);

  const toggleOption = (option: {
    username: string;
    verified: boolean;
    id?: string;
  }) => {
    const isSelected =
      selectedOptions.findIndex(
        (value) => value.username === option.username
      ) !== -1;

    if (!isSelected && canSelectMore) {
      if (canSelectMore) {
        setSearch("");
        setSelectedOptions((prev) => [...prev, option]);
      }
      return;
    }

    if (isSelected) {
      setSelectedOptions((prev) =>
        prev.filter((v) => v.username !== option.username)
      );
    }
  };

  const removeOption = React.useCallback((option: UserOption) => {
    setSelectedOptions((prev) =>
      prev.filter((item) => item.username !== option.username)
    );
  }, []);

  React.useEffect(() => {
    const usernames = selectedOptions.map((value) => value.username);
    const userIds = selectedOptions
      .map((value) => value.id || "")
      .filter(Boolean);

    onValueChangeRef.current(usernames, userIds);
  }, [selectedOptions]);

  const handleClearAll = React.useCallback(() => {
    setSelectedOptions([]);
    setSearch("");
  }, []);

  return (
    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
      <DrawerTrigger asChild>
        <Button
          {...props}
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="min-h-10 flex h-auto w-full items-center justify-between rounded-md border bg-inherit hover:bg-card"
          disabled={disabled}
        >
          {selectedOptions.length > 0 ? (
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-wrap items-center">
                {selectedOptions.map((value) => (
                  <Badge
                    key={`badge-${value.username}`}
                    className={cn(userPickerVariants({ variant, className }))}
                  >
                    {value.verified && (
                      <BadgeCheckIcon className="ml-1 h-3 w-3 text-blue-500" />
                    )}
                    {value.username}
                  </Badge>
                ))}
              </div>
              <SelectionSummary
                selectedCount={selectedOptions.length}
                minSelection={minSelection}
                maxSelection={maxSelection}
              />
            </div>
          ) : (
            <div className="mx-auto flex w-full items-center justify-between">
              <span className="mx-3 text-sm text-muted-foreground">
                {placeholder}
              </span>
              <div className="flex items-center gap-2">
                <SelectionSummary
                  selectedCount={selectedOptions.length}
                  minSelection={minSelection}
                  maxSelection={maxSelection}
                />
              </div>
            </div>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-none px-4 pb-4 md:max-w-2xl lg:max-w-4xl">
          <DrawerTitle className="sr-only">{t("selectUsers")}</DrawerTitle>
          <div className="flex flex-col gap-4 pt-4">
            {/* Search Input */}
            <Input
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full"
            />

            {/* Selected Users Section */}
            {selectedOptions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {t("selectedUsers")}{" "}
                    <SelectionSummary
                      selectedCount={selectedOptions.length}
                      minSelection={minSelection}
                      maxSelection={maxSelection}
                    />
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="text-red-500 hover:text-red-600"
                  >
                    {t("clearAll")}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedOptions.map((value) => (
                    <Badge
                      key={`selected-${value.username}`}
                      className={cn(
                        userPickerVariants({ variant, className }),
                        "cursor-pointer"
                      )}
                    >
                      {value.verified && (
                        <BadgeCheckIcon className="ml-1 h-3 w-3 text-blue-500" />
                      )}
                      {value.username}
                      <XIcon
                        className="mr-1 h-3 w-3 cursor-pointer text-red-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeOption(value);
                        }}
                      />
                    </Badge>
                  ))}
                </div>
                <Separator />
              </div>
            )}

            {/* Users List */}
            <ScrollArea className="h-[300px] w-full">
              <div className="space-y-4">
                {/* Instagram Users (Unverified) */}
                {canPicknNonUser &&
                canSelectMore &&
                search.length &&
                // Check if the user is not selected and is not a valid profile
                ![...(profiles || []), ...selectedOptions].find(
                  (v) => v.username === normalizedSearch
                ) ? (
                  <UnverifiedUser
                    normalizedSearch={normalizedSearch}
                    toggleOption={toggleOption}
                  />
                ) : null}

                {/* Verified Users */}
                {unselectedProfiles && unselectedProfiles.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {t("verifiedUsers")}
                    </h3>
                    <div className="space-y-1">
                      {unselectedProfiles.map((profile) => (
                        <VerifiedUser
                          key={profile.id}
                          profile={profile}
                          canSelectMore={canSelectMore}
                          toggleOption={toggleOption}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isPending && (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
UserPicker.displayName = "UserPicker";

const VerifiedUser: React.FC<{
  profile: Tables<"profiles">;
  canSelectMore: boolean;
  toggleOption: (option: {
    username: string;
    verified: boolean;
    id?: string;
  }) => void;
}> = ({ profile, canSelectMore, toggleOption }) => {
  if (!profile.username) return null;
  const username = profile.username;
  const isDisabled = !canSelectMore;

  return (
    <div
      key={`verified-${username}`}
      className={cn(
        "flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-muted",
        isDisabled && "cursor-not-allowed opacity-50"
      )}
      onClick={() => {
        if (canSelectMore) {
          toggleOption({
            username,
            verified: true,
            id: profile.id,
          });
        }
      }}
    >
      {profile.profile_picture && (
        <Image
          alt={`${username} profile picture`}
          src={profile.profile_picture || "/placeholder.svg"}
          width={24}
          height={24}
          className="h-6 w-6 rounded-full"
        />
      )}
      <div className="flex flex-1 flex-col">
        <span className="line-clamp-1 text-ellipsis text-sm">
          {profile.name}
        </span>
        <span className="text-xs text-muted-foreground">{username}</span>
      </div>
      <BadgeCheckIcon className="h-4 w-4 text-blue-500" />
    </div>
  );
};

const SelectionSummary: React.FC<{
  selectedCount: number;
  minSelection: number;
  maxSelection?: number;
}> = ({ selectedCount, minSelection, maxSelection }) => {
  const getSelectionText = (): string => {
    if (minSelection > 0 && maxSelection) {
      return `(${selectedCount}/${minSelection}-${maxSelection})`;
    } else if (minSelection > 0) {
      return `(${selectedCount}/${minSelection}+)`;
    } else if (maxSelection) {
      return `(${selectedCount}/${maxSelection})`;
    }
    return selectedCount > 0 ? `(${selectedCount})` : "";
  };

  const selectionText = getSelectionText();

  return selectionText ? (
    <span className="text-xs text-muted-foreground">{selectionText}</span>
  ) : null;
};

const UnverifiedUser: React.FC<{
  normalizedSearch: string;
  toggleOption: (option: {
    username: string;
    verified: boolean;
    id?: string;
  }) => void;
}> = ({ normalizedSearch, toggleOption }) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">Instagram</h3>
      <div
        className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-muted"
        onClick={() => {
          toggleOption({
            username: normalizedSearch,
            verified: false,
          });
        }}
      >
        <span>{normalizedSearch}</span>
      </div>
    </div>
  );
};
