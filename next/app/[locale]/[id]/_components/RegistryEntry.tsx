"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { PlusSvg } from "@/assets";
import { SuccessAnimation } from "@/components/animations/SuccessAnimation";
import { Button, ButtonLoading } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import NumberPicker from "@/components/ui/NumberPicker";
import { Textarea } from "@/components/ui/textarea";
import { transformTimeStringToSeconds } from "@/utils/helperFunctions";
import useSupabaseBrowser from "@/utils/supabase/client";

import MultiSelectFormField from "./witness-select";

const formSchema = z.object({
  instagram: z
    .string()
    .trim()
    .startsWith("@", "O usuário deve começar com @")
    .min(3, "Deve conter ao menos 3 caracteres"),
  cadenas: z.number().nonnegative(),
  full_lines: z.number().nonnegative(),
  distance: z.coerce
    .number({
      required_error: "Insira quantos metros você andou",
      invalid_type_error: "Insira um número",
    })
    .positive("Distância não pode ser negativa"),
  time: z
    .string()
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === "" ||
        /^([0-9]|[0-5][0-9]):[0-5][0-9]$/.test(value),
      "Inválido, use o formato mm:ss"
    ),
  witness: z.string().min(2).array().length(2),
  comment: z.string(),
});

type FormSchema = z.infer<typeof formSchema>;

interface Props {
  highlineId: string;
  highlineDistance: number;
}

export const RegistryEntry = ({ highlineId, highlineDistance }: Props) => {
  const supabase = useSupabaseBrowser();

  const t = useTranslations("highline.registry");
  const queryClient = useQueryClient();

  const entryForm = useForm<FormSchema>({
    mode: "onTouched",
    resolver: zodResolver(formSchema),
    shouldUnregister: true,
    defaultValues: {
      instagram: "",
      cadenas: 0,
      full_lines: 0,
      distance: 0,
      time: "",
      witness: [],
      comment: "",
    },
  });

  useEffect(() => {
    async function setUsername() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      entryForm.setValue(
        "instagram",
        session?.user.user_metadata["username"] || ""
      );
    }
    setUsername();
  }, [supabase.auth, entryForm]);

  const watchCadenas = entryForm.watch("cadenas");
  const watchFullLines = entryForm.watch("full_lines");

  useEffect(() => {
    const totalLeaps = watchCadenas + watchFullLines * 2;
    const totalDistance = highlineDistance * totalLeaps;
    if (totalDistance) entryForm.setValue("distance", totalDistance);
  }, [watchCadenas, watchFullLines, highlineDistance, entryForm]);

  const formMutation = useMutation({
    mutationFn: async (formData: FormSchema) => {
      const response = await supabase.from("entry").insert([
        {
          highline_id: highlineId,
          instagram: formData.instagram.toLowerCase(),
          cadenas: formData.cadenas,
          full_lines: formData.full_lines,
          distance_walked: formData.distance,
          crossing_time: formData.time
            ? transformTimeStringToSeconds(formData.time)
            : null,
          comment: formData.comment,
          witness: formData.witness,
          is_highliner: true, // TODO: Remove this field from database
        },
      ]);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entry"] });
    },
    onError: (e) => {
      console.error(e.message);
    },
  });

  const onSubmit = (formData: FormSchema) => {
    formMutation.mutate(formData);
  };

  const onError = (e: unknown) => {
    console.log("Error");
    console.log(e);
  };

  return (
    <Drawer
      onClose={() => {
        if (formMutation.isSuccess) formMutation.reset();
      }}
    >
      <DrawerTrigger asChild>
        <Button variant="default">{t("trigger")}</Button>
      </DrawerTrigger>

      <DrawerContent onPointerDownOutside={(e) => true && e.preventDefault()}>
        <div className="scrollbar mx-auto flex w-full max-w-md flex-col overflow-auto rounded-t-[10px] p-4">
          {formMutation.isSuccess ? (
            <>
              <DrawerHeader className="mb-4 p-0">
                <DrawerTitle>{t("success.header")}</DrawerTitle>
                <span className="block"> 🆑 🆑 🆑 🆑 🆑</span>
                <DrawerDescription>{t("success.message")}</DrawerDescription>
              </DrawerHeader>
              <SuccessAnimation />
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button>{t("success.close")}</Button>
                </DrawerClose>
              </DrawerFooter>
            </>
          ) : (
            <>
              <DrawerHeader className="mb-4 p-0">
                <DrawerTitle>{t("title")}</DrawerTitle>
                <DrawerDescription>{t("description")}</DrawerDescription>
              </DrawerHeader>
              <Form {...entryForm}>
                <form
                  onSubmit={entryForm.handleSubmit(onSubmit, onError)}
                  className="space-y-6"
                >
                  <FormField
                    control={entryForm.control}
                    name="instagram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Highliner</FormLabel>
                        <FormDescription>
                          {t("instagram.description")}
                        </FormDescription>
                        <FormControl>
                          <Input
                            placeholder={t("instagram.placeholder")}
                            {...field}
                            onChange={(event) =>
                              field.onChange(event.target.value.trim())
                            }
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={entryForm.control}
                    name="cadenas"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between gap-4">
                          <div>
                            <FormLabel>{t("cadenas.label")}</FormLabel>
                            <FormDescription>
                              {t("cadenas.description")}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <NumberPicker
                              value={field.value}
                              onChange={field.onChange}
                              className="self-end"
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={entryForm.control}
                    name="full_lines"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex justify-between gap-4">
                          <div>
                            <FormLabel>Full lines</FormLabel>
                            <FormDescription>
                              {t("fullLines.description")}
                            </FormDescription>
                          </div>
                          <FormControl>
                            <NumberPicker
                              value={field.value}
                              onChange={field.onChange}
                              className="self-end"
                            />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={entryForm.control}
                    name="distance"
                    render={({ field }) => (
                      <FormItem>
                        <div>
                          <FormLabel>{t("distance.label")}</FormLabel>
                          <FormDescription>
                            {t("distance.description")}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder={t("distance.placeholder")}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={entryForm.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <div>
                          <FormLabel optional>Speedline</FormLabel>
                          <FormDescription>
                            {t("speedline.description")}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Input
                            placeholder={t("speedline.placeholder")}
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={entryForm.control}
                    name="witness"
                    render={({ field }) => (
                      <FormItem>
                        <div>
                          <FormLabel>{t("witness.label")}</FormLabel>
                          <FormDescription>
                            {t("witness.description")}
                          </FormDescription>
                        </div>

                        <FormControl>
                          <MultiSelectFormField
                            defaultValue={field.value}
                            onValueChange={field.onChange}
                            placeholder={t("witness.placeholder")}
                            variant="secondary"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={entryForm.control}
                    name="comment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel optional>{t("comment.label")}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t("comment.placeholder")}
                            rows={3}
                            className="resize-none"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DrawerFooter className="p-0">
                    {formMutation.isPending ? (
                      <ButtonLoading />
                    ) : (
                      <Button type="submit">
                        <PlusSvg className="mr-2 h-4 w-4" />
                        {t("submit")}
                      </Button>
                    )}
                  </DrawerFooter>
                </form>
              </Form>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
