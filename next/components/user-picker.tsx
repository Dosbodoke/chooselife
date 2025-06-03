"use client";

import { useQuery } from "@tanstack/react-query";
import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheckIcon, CheckIcon, XIcon, Users } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";
import debounce from "lodash.debounce";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import useSupabaseBrowser from "@/utils/supabase/client";
import { useDebounceValue } from "@/hooks/use-debounce-value";

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
  const supabase = useSupabaseBrowser();
  const t = useTranslations("userPicker");
  const [search, setSearch] = React.useState("");
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const debouncedSearch = useDebounceValue(search);

  const normalizedSearch = React.useMemo(
    () => (!search || search.startsWith("@") ? search : `@${search}`),
    [search]
  );

  const { data, isPending } = useQuery({
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

  const canSelectMore = React.useMemo(() => {
    if (!maxSelection) return true;
    return selectedOptions.length < maxSelection;
  }, [selectedOptions.length, maxSelection]);

  const toggleOption = (option: {
    username: string;
    verified: boolean;
    id?: string;
  }) => {
    const idx = selectedOptions.findIndex(
      (value) => value.username === option.username
    );
    if (idx === -1) {
      if (canSelectMore) {
        setSearch("");
        setSelectedOptions((prev) => [...prev, option]);
      }
    } else {
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

  const isMinimumMet = selectedOptions.length >= minSelection;

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
                    {value.username}
                    {value.verified && (
                      <BadgeCheckIcon className="ml-1 h-3 w-3 text-blue-500" />
                    )}
                  </Badge>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <SelectionSummary
                  selectedCount={selectedOptions.length}
                  minSelection={minSelection}
                  maxSelection={maxSelection}
                />
              </div>
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
            <div className="space-y-2">
              <Input
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
              {minSelection > 0 && !isMinimumMet && (
                <p className="text-sm text-muted-foreground">
                  {t("minimumSelection", {
                    count: minSelection,
                    plural: minSelection > 1 ? t("users") : t("user"),
                  })}
                </p>
              )}
            </div>

            {/* Selected Users Section */}
            {selectedOptions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {t("selectedUsers")}

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
                      <XIcon
                        className="mr-1 h-3 w-3 cursor-pointer text-red-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeOption(value);
                        }}
                      />
                      {value.username}
                      {value.verified && (
                        <BadgeCheckIcon className="ml-1 h-3 w-3 text-blue-500" />
                      )}
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
                  (search.length > 0 ||
                    selectedOptions.find(
                      (value) => value.verified === false
                    )) && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        Instagram
                      </h3>
                      <div className="space-y-1">
                        {normalizedSearch &&
                          !data?.find(
                            (dt) => dt.username === normalizedSearch
                          ) && (
                            <div
                              className={cn(
                                "flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-muted",
                                !canSelectMore &&
                                  selectedOptions.findIndex(
                                    (value) =>
                                      value.username === normalizedSearch
                                  ) === -1 &&
                                  "cursor-not-allowed opacity-50"
                              )}
                              onClick={() => {
                                if (
                                  canSelectMore ||
                                  selectedOptions.findIndex(
                                    (value) =>
                                      value.username === normalizedSearch
                                  ) !== -1
                                ) {
                                  toggleOption({
                                    username: normalizedSearch,
                                    verified: false,
                                  });
                                }
                              }}
                            >
                              <div
                                className={cn(
                                  "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  selectedOptions.findIndex(
                                    (value) =>
                                      value.username === normalizedSearch
                                  ) !== -1
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50"
                                )}
                              >
                                {selectedOptions.findIndex(
                                  (value) => value.username === normalizedSearch
                                ) !== -1 && <CheckIcon className="h-3 w-3" />}
                              </div>
                              <span>{normalizedSearch}</span>
                            </div>
                          )}

                        {selectedOptions.map((value) => {
                          if (
                            value.verified === true ||
                            value.username === normalizedSearch
                          )
                            return null;
                          return (
                            <div
                              key={`unverified-${value.username}`}
                              className="flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-muted"
                              onClick={() => toggleOption(value)}
                            >
                              <div className="flex h-4 w-4 items-center justify-center rounded-sm border border-primary bg-primary text-primary-foreground">
                                <CheckIcon className="h-3 w-3" />
                              </div>
                              <span>{value.username}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Verified Users */}
                {data && data.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      {t("verifiedUsers")}
                    </h3>
                    <div className="space-y-1">
                      {data.map((dt) => {
                        if (!dt.username) return null;
                        const username = dt.username;
                        const isSelected = selectedOptions.find(
                          (value) => value.username === username
                        );
                        const isDisabled = !canSelectMore && !isSelected;

                        return (
                          <div
                            key={`verified-${username}`}
                            className={cn(
                              "flex cursor-pointer items-center space-x-3 rounded-md p-2 hover:bg-muted",
                              isDisabled && "cursor-not-allowed opacity-50"
                            )}
                            onClick={() => {
                              if (!isDisabled) {
                                toggleOption({
                                  username,
                                  verified: true,
                                  id: dt.id,
                                });
                              }
                            }}
                          >
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "opacity-50"
                              )}
                            >
                              {isSelected && <CheckIcon className="h-3 w-3" />}
                            </div>
                            {dt.profile_picture && (
                              <Image
                                alt={`${username} profile picture`}
                                src={dt.profile_picture || "/placeholder.svg"}
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-full"
                              />
                            )}
                            <div className="flex flex-1 flex-col">
                              <span className="line-clamp-1 text-ellipsis text-sm">
                                {dt.name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {username}
                              </span>
                            </div>
                            <BadgeCheckIcon className="h-4 w-4 text-blue-500" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {isPending && (
                  <div className="space-y-2">
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
