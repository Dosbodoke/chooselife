"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { LatLng } from "leaflet";
import { PlusIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { PlusSvg } from "@/assets";
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
import { Link } from "@/navigation";
import {
  decodeLocation,
  getDistance,
  locationToPostGISPoint,
} from "@/utils/helperFunctions";
import useSupabaseBrowser from "@/utils/supabase/client";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from "@/utils/supabase/constants";

import { SuccessAnimation } from "./animations/SuccessAnimation";
import Dropzone from "./ui/Dropzone";
import { Form, FormControl, FormField, FormItem, FormLabel } from "./ui/form";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const formSchema = z.object({
  name: z.string().min(3, "Deve conter ao menos 3 caracteres"),
  height: z.coerce
    .number({
      required_error: "Insira a altura do Highline",
      invalid_type_error: "Insira um número",
    })
    .positive("Altura não pode ser negativa"),
  length: z.coerce
    .number({
      required_error: "Insira o comprimento do Highline",
      invalid_type_error: "Insira um número",
    })
    .positive("Comprimento não pode ser negativo"),
  description: z.string().optional(),
  image: z
    .any()
    .optional()
    .refine(
      (files) => (files?.length > 0 ? files[0]?.size <= MAX_FILE_SIZE : true),
      `Tamanho máximo do arquivo é 6MB`
    )
    .refine(
      (files) =>
        files?.length > 0
          ? ACCEPTED_IMAGE_TYPES.includes(files[0]?.type)
          : true,
      "Formatos aceitos são: .jpg, .jpeg, .png e .webp"
    ),
});

type FormSchema = z.infer<typeof formSchema>;

const CreateHighline = ({
  mapIsOpen,
  location,
  showTrigger,
}: {
  mapIsOpen: boolean;
  location: string | null;
  showTrigger?: boolean;
}) => {
  const [_, setLocationParam] = useQueryState("location");
  const [open, setOpen] = useState(false);

  function handleToggleDrawer(open: boolean) {
    // If user is on map, set location query parameter to picking so he can set the anchors
    if (mapIsOpen && !location) {
      setLocationParam("picking");
      return;
    }
    // If user is picking location don't open the Drawer
    if (location === "picking") return;
    // If there is a location setted and he is closing the drawer, reset the location
    if (open === false && location) {
      setLocationParam(null);
    }
    setOpen(open);
  }

  useEffect(
    function openOnFinishPickingLocation() {
      if (location && location !== "picking") {
        setOpen(true);
      }
    },
    [location]
  );

  const supabase = useSupabaseBrowser();

  const t = useTranslations("home.newHighline");
  const [newHighlineUUID, setNewHighlineUUID] = useState<string | null>(null);

  const highlineForm = useForm<FormSchema>({
    mode: "onTouched",
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      height: undefined,
      length: undefined,
      image: "",
      description: "",
    },
  });

  async function createHighline({
    name,
    height,
    length,
    description,
    image,
  }: FormSchema) {
    // Get the anchors location if exists
    let anchors: {
      anchorA: LatLng;
      anchorB: LatLng;
    } | null = null;
    if (location && location !== "" && location !== "picking") {
      try {
        const decoded = decodeLocation(location);
        const L = (await import("leaflet")).default;
        const anchorA = L.latLng(
          parseFloat(decoded[1]),
          parseFloat(decoded[2])
        );
        const anchorB = L.latLng(
          parseFloat(decoded[3]),
          parseFloat(decoded[4])
        );
        anchors = { anchorA, anchorB };
      } catch (e) {
        console.log(e);
      }
    }

    // Upload the image
    let imageID: string | null = null;
    if (image && image.length > 0) {
      const file = image[0];
      const extension = file.type.split("/")[1];
      imageID = `${uuidv4()}.${extension}`;
      // Create a new Blob from the file
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      // Upload the blob
      const { error } = await supabase.storage
        .from("images")
        .upload(imageID, blob);
      if (error) throw new Error("Couldn't upload the image");
    }

    const { data, error } = await supabase
      .from("highline")
      .insert([
        {
          name,
          height,
          length,
          description,
          cover_image: imageID,
          anchor_a: anchors?.anchorA
            ? locationToPostGISPoint(anchors.anchorA)
            : null,
          anchor_b: anchors?.anchorB
            ? locationToPostGISPoint(anchors.anchorB)
            : null,
        },
      ])
      .select();
    if (error || !data || data.length !== 1) {
      throw new Error("Error when creating the highline");
    }
    return data[0].id;
  }

  const { mutate, isPending, isSuccess } = useMutation<
    string,
    Error,
    FormSchema
  >({
    mutationFn: (data) => createHighline(data),
    onError: (e) => {
      console.log(e.message);
    },
    onSuccess: (data) => {
      setNewHighlineUUID(data);
    },
  });

  const onSubmit = (formData: FormSchema) => {
    mutate(formData);
  };

  const onError = (e: unknown) => {
    console.log("Invalid form");
  };

  useEffect(() => {
    async function setDistanceFromLocation(loc: string) {
      try {
        const decoded = decodeLocation(loc);
        const L = (await import("leaflet")).default;
        const anchorA = L.latLng(
          parseFloat(decoded[1]),
          parseFloat(decoded[2])
        );
        const anchorB = L.latLng(
          parseFloat(decoded[3]),
          parseFloat(decoded[4])
        );
        highlineForm.setValue("length", getDistance({ anchorA, anchorB }));
      } catch (e) {
        if (e instanceof Error) console.error(e.message);
        return;
      }
    }

    if (!location || location === "picking") return;
    setDistanceFromLocation(location);
  }, [location, highlineForm]);

  return (
    <Drawer open={open} onOpenChange={(o) => handleToggleDrawer(o)}>
      <AnimatePresence>
        {showTrigger && (
          <DrawerTrigger asChild>
            <motion.button
              key="drawer-trigger"
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 25, opacity: 0 }}
              transition={{ type: "spring", bounce: 0.5, duration: 0.3 }}
              className="fixed bottom-3 right-6 z-50 p-[3px]"
            >
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
              <div className="group relative rounded-full bg-black p-2 text-white transition duration-200 hover:bg-transparent">
                <PlusIcon />
              </div>
            </motion.button>
          </DrawerTrigger>
        )}
      </AnimatePresence>

      {isSuccess ? (
        <DrawerContent className="h-fit">
          <DrawerHeader className="px-0">
            <DrawerTitle>{t("success.header")}</DrawerTitle>
            <span className="block text-center"> 🆑 🆑 🆑 🆑 🆑</span>
            <DrawerDescription>{t("success.message")}</DrawerDescription>
          </DrawerHeader>
          <SuccessAnimation />
          <DrawerFooter>
            <Button asChild>
              <Link href={`/${newHighlineUUID}`}>{t("successLink")}</Link>
            </Button>
          </DrawerFooter>
        </DrawerContent>
      ) : (
        <DrawerContent>
          <div className="scrollbar mx-auto flex w-full max-w-md flex-col overflow-auto rounded-t-[10px] p-4">
            <DrawerHeader className="px-0">
              <DrawerTitle>{t("title")}</DrawerTitle>
              <DrawerDescription>{t("description")}</DrawerDescription>
            </DrawerHeader>
            <Form {...highlineForm}>
              <form
                onSubmit={highlineForm.handleSubmit(onSubmit, onError)}
                className="space-y-6"
              >
                <FormField
                  control={highlineForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("name.label")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("name.placeholder")} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={highlineForm.control}
                  name="height"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("height.label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t("height.placeholder")}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={highlineForm.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("length.label")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t("length.placeholder")}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={highlineForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("highlineDescription.label")}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder={t("highlineDescription.placeholder")}
                          rows={3}
                          className="resize-none"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={highlineForm.control}
                  name="image"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Dropzone
                          id="image"
                          label={t("image.label")}
                          file={field.value}
                          errorMessage={highlineForm.formState.errors.image?.message?.toString()}
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              // Call the provided onChange with the actual File object
                              field.onChange(e.target.files[0]);
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DrawerFooter className="p-0">
                  {isPending ? (
                    <ButtonLoading />
                  ) : (
                    <>
                      <Button type="submit">
                        <PlusSvg className="mr-2 h-4 w-4" />
                        {t("submit")}
                      </Button>
                      <DrawerClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DrawerClose>
                    </>
                  )}
                </DrawerFooter>
              </form>
            </Form>
          </div>
        </DrawerContent>
      )}
    </Drawer>
  );
};

export default CreateHighline;
