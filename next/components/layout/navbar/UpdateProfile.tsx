"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, ButtonLoading } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import useSupabaseBrowser from "@/utils/supabase/client";
import type { Database } from "@/utils/supabase/database.types";

const formSchema = z.object({
  name: z.string().min(3, "Deve conter ao menos 3 caracteres"),
  description: z.string().optional(),
  birthday: z
    .date({
      required_error: "A date of birth is required.",
    })
    .nullable(),
});

type FormSchema = z.infer<typeof formSchema>;

export default function UpdateProfile({
  profile,
}: {
  profile: Database["public"]["Tables"]["profiles"]["Row"];
}) {
  const dateLocale = useLocale() === "pt" ? ptBR : enUS;
  const t = useTranslations("updateProfile");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = useSupabaseBrowser();
  const form = useForm<FormSchema>({
    mode: "onTouched",
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: profile.name || "",
      description: profile.description || "",
      birthday: profile.birthday ? new Date(profile.birthday) : null,
    },
  });

  const profileMutation = useMutation<void, Error, FormSchema>({
    mutationFn: async (formData) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          description: formData.description,
          name: formData.name,
          birthday: formData.birthday?.toDateString(),
        })
        .eq("id", profile.id);

      if (error) throw new Error(error.message);

      await supabase.auth.updateUser({
        data: {
          displayName: formData.name,
        },
      });
    },
    onSuccess() {
      setOpen(false);
      router.refresh();
    },
    onError: () => {
      form.setError("root", {
        message: "Error on upadting the profile, try again later!",
      });
    },
  });

  const onSubmit = (data: FormSchema) => {
    profileMutation.mutate(data);
  };

  const onError = (e: unknown) => {
    console.log("Invalid form");
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">{t("trigger")}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="scrollbar mx-auto flex w-full max-w-md flex-col space-y-4 overflow-auto rounded-t-[10px] p-4">
          <DrawerHeader className="p-0">
            <DrawerTitle>{t("title")}</DrawerTitle>
          </DrawerHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, onError)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.name.label")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("fields.name.placeholder")}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.description.label")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t("fields.description.placeholder")}
                        rows={3}
                        className="resize-none"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthday"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>{t("fields.birthday.label")}</FormLabel>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", {
                                locale: dateLocale,
                              })
                            ) : (
                              <span>{t("fields.birthday.placeholder")}</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          initialFocus
                          mode="single"
                          captionLayout="dropdown-buttons"
                          locale={dateLocale}
                          selected={field.value || undefined}
                          fromYear={1900}
                          toYear={new Date().getFullYear()}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date > new Date() || date < new Date("1900-01-01")
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DrawerFooter className="p-0">
                {profileMutation.isPending ? (
                  <ButtonLoading />
                ) : (
                  <Button type="submit">{t("fields.submit")}</Button>
                )}
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
