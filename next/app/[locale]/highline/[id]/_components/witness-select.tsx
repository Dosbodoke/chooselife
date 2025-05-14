import { useQuery } from "@tanstack/react-query";
import { cva, type VariantProps } from "class-variance-authority";
import { BadgeCheckIcon, CheckIcon, ChevronDown, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import useSupabaseBrowser from "@/utils/supabase/client";

const multiSelectVariants = cva(
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

interface MultiSelectFormFieldProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
  asChild?: boolean;
  defaultValue?: string[];
  disabled?: boolean;
  placeholder: string;
  className?: string;
  onValueChange: (value: string[]) => void;
}

const MultiSelectFormField = React.forwardRef<
  HTMLButtonElement,
  MultiSelectFormFieldProps
>(
  (
    {
      className,
      variant,
      asChild = false,
      defaultValue,
      onValueChange,
      disabled,
      placeholder,
      ...props
    },
    ref
  ) => {
    const supabase = useSupabaseBrowser();
    const t = useTranslations("highline.registry.witness");
    const [search, setSearch] = React.useState("");
    const normalizedSearch = React.useMemo(
      () => (!search || search.startsWith("@") ? search : `@${search}`),
      [search]
    );
    const [debouncedInputValue, setDebouncedInputValue] = React.useState("");

    const {
      data,
      refetch: refetchProfile,
      isPending,
    } = useQuery({
      queryKey: ["profiles", { username: debouncedInputValue }],
      queryFn: async () => {
        const query = supabase.from("profiles").select("*");

        if (debouncedInputValue) {
          query.ilike("username", `%${debouncedInputValue}%`);
        } else {
          query.limit(5);
        }
        const response = await query;
        return response.data;
      },
    });

    const [selectedOption, setSelectedOption] = React.useState<
      { username: string; verified: boolean }[]
    >([]);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

    // use debounce
    React.useEffect(() => {
      const timeoutId = setTimeout(() => {
        setDebouncedInputValue(search);
      }, 750);
      return () => clearTimeout(timeoutId);
    }, [search]);

    React.useEffect(() => {
      refetchProfile();
    }, [debouncedInputValue, refetchProfile]);

    const handleInputKeyDown = (event: any) => {
      if (event.key === "Enter") {
        setIsPopoverOpen(true);
      } else if (event.key === "Backspace" && !event.target.value) {
        setSelectedOption((prev) => prev.slice(0, prev.length - 1));
      }
    };

    const toggleOption = (option: { username: string; verified: boolean }) => {
      const idx = selectedOption.findIndex(
        (value) => value.username === option.username
      );
      if (idx === -1) {
        setSearch("");
        setSelectedOption((prev) => [...prev, option]);
      } else {
        setSelectedOption((prev) =>
          prev.filter((v) => v.username !== option.username)
        );
      }
    };

    React.useEffect(() => {
      onValueChange(selectedOption.map((value) => value.username));
    }, [selectedOption, onValueChange]);

    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} modal>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            {...props}
            onClick={() => setIsPopoverOpen(!isPopoverOpen)}
            className="min-h-10 flex h-auto w-full items-center justify-between rounded-md border bg-inherit hover:bg-card"
          >
            {selectedOption.length > 0 ? (
              <div className="flex w-full items-center justify-between">
                <div className="flex flex-wrap items-center">
                  {selectedOption.map((value) => {
                    return (
                      <Badge
                        key={`badge-${value.username}`}
                        className={cn(
                          multiSelectVariants({ variant, className })
                        )}
                      >
                        <XIcon
                          className="h-4 w-4 cursor-pointer text-red-500"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleOption(value);
                          }}
                        />
                        {value.username}
                        {value.verified && (
                          <BadgeCheckIcon className="h-4 w-4 text-blue-500" />
                        )}
                      </Badge>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between">
                  <Separator orientation="vertical" />
                  <ChevronDown className="mx-2 h-4 cursor-pointer text-muted-foreground" />
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full items-center justify-between">
                <span className="mx-3 text-sm text-muted-foreground">
                  {placeholder}
                </span>
                <Separator orientation="vertical" />
                <ChevronDown className="mx-2 h-4 cursor-pointer text-muted-foreground" />
              </div>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 drop-shadow-sm"
          align="start"
          side="top"
          sideOffset={12}
          onEscapeKeyDown={(e) => {
            e.stopPropagation();
            setIsPopoverOpen(false);
          }}
          onInteractOutside={(event) => {
            if (!event.defaultPrevented) {
              setIsPopoverOpen(false);
            }
          }}
          portal={false}
        >
          <Command loop shouldFilter={false}>
            <CommandInput
              placeholder={t("searchPlaceholder")}
              onKeyDown={handleInputKeyDown}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {search.length > 0 ||
              selectedOption.find((value) => value.verified === false) ? (
                <CommandGroup heading="Instagram">
                  {normalizedSearch &&
                  !data?.find((dt) => dt.username === normalizedSearch) ? (
                    <CommandItem
                      onSelect={() =>
                        toggleOption({
                          username: normalizedSearch,
                          verified: false,
                        })
                      }
                      style={{
                        pointerEvents: "auto",
                      }}
                      disabled={
                        selectedOption.length === 2 &&
                        selectedOption.findIndex(
                          (value) => value.username === normalizedSearch
                        ) === -1
                      }
                      className="my-1 cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:opacity-60"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          selectedOption.findIndex(
                            (value) => value.username === normalizedSearch
                          ) !== -1
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <CheckIcon className="h-4 w-4" />
                      </div>
                      <span>{normalizedSearch}</span>
                    </CommandItem>
                  ) : (
                    false
                  )}
                  {selectedOption.map((value) => {
                    if (
                      value.verified === true ||
                      value.username === normalizedSearch
                    )
                      return null;
                    return (
                      <CommandItem
                        key={`item-${value.username}`}
                        onSelect={() => toggleOption(value)}
                        style={{
                          pointerEvents: "auto",
                        }}
                        className="my-1 cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:opacity-60"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            "bg-primary text-primary-foreground"
                          )}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </div>
                        <span>{value.username}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              {data && data.length > 0 ? (
                <CommandGroup heading={t("verifiedHeading")}>
                  {data?.map((dt) => {
                    if (!dt.username) return null;
                    const username = dt.username;
                    const isSelected = selectedOption.find(
                      (value) => value.username === username
                    );
                    return (
                      <CommandItem
                        key={`item-${username}`}
                        onSelect={() =>
                          toggleOption({ username, verified: true })
                        }
                        style={{
                          pointerEvents: "auto",
                        }}
                        disabled={selectedOption.length === 2 && !isSelected}
                        className="my-1 cursor-pointer aria-disabled:cursor-not-allowed aria-disabled:bg-muted aria-disabled:opacity-60"
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </div>
                        {dt.profile_picture && (
                          <Image
                            alt={`${username} profile picture`}
                            src={dt.profile_picture}
                            width={24}
                            height={24}
                            className="mr-2 h-6 w-6 rounded-full text-muted-foreground"
                          />
                        )}
                        <div className="flex flex-1 flex-col">
                          <span className="line-clamp-1 text-ellipsis">
                            {dt.name}
                          </span>
                          <span className="text-muted-foreground">
                            {username}
                          </span>
                        </div>
                        <BadgeCheckIcon className="ml-2 h-4 w-4 text-blue-500" />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ) : null}
              {isPending && (
                <CommandLoading className="overflow-hidden p-1 [&>div]:flex [&>div]:flex-col [&>div]:gap-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </CommandLoading>
              )}
              <CommandSeparator />
              <CommandGroup>
                <div className="relative flex gap-1">
                  {selectedOption.length > 0 && (
                    <>
                      <CommandItem
                        onSelect={() => {
                          setSelectedOption([]);
                        }}
                        style={{
                          pointerEvents: "auto",
                          opacity: 1,
                        }}
                        className="flex-1 cursor-pointer justify-center text-red-500"
                      >
                        {t("clear")}
                      </CommandItem>
                      <Separator
                        orientation="vertical"
                        className="absolute left-1/2 my-auto"
                      />
                    </>
                  )}
                  <CommandItem
                    onSelect={() => setIsPopoverOpen(false)}
                    style={{
                      pointerEvents: "auto",
                      opacity: 1,
                    }}
                    className="flex-1 cursor-pointer justify-center"
                  >
                    {t("close")}
                  </CommandItem>
                </div>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

MultiSelectFormField.displayName = "MultiSelectFormField";

export default MultiSelectFormField;
