"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { GoogleIcon } from "@/assets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import useSupabaseBrowser from "@/utils/supabase/client";
import { useLoginModal } from "@/utils/useLoginModal";

const formSchema = z.object({
  email: z.string().email(),
});

type FormSchema = z.infer<typeof formSchema>;

function SignUp() {
  const supabase = useSupabaseBrowser();
  const t = useTranslations("login");
  const { open, toggleLoginModal } = useLoginModal();

  const [step, setStep] = useState<"initial" | "email" | "inbox">("initial");
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?redirect_to=${location.href}`,
      },
    });
  }

  async function signInWithOtp(data: FormSchema) {
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${location.origin}/auth/callback?redirect_to=${location.href}`,
      },
    });

    if (!error) {
      setStep("inbox");
    }
  }

  const dialogContentInitial = () => (
    <>
      <DialogHeader>
        <DialogTitle>{t("initial.title")}</DialogTitle>
        <DialogDescription className="mb-2">
          {t("initial.description")}
        </DialogDescription>
      </DialogHeader>
      <Button variant={"outline"} onClick={signInWithGoogle}>
        <GoogleIcon className="-ml-1 mr-2 h-5 w-5" />
        {t("initial.google")}
      </Button>
      <Button variant="link" onClick={() => setStep("email")}>
        {t("email.buttonLabel")}
      </Button>
    </>
  );

  const dialogContentEmail = () => (
    <>
      <DialogHeader>
        <DialogTitle>{t("email.title")}</DialogTitle>
        <DialogDescription>{t("email.description")}</DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(signInWithOtp)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder={t("email.placeholder")}
                    type="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage translatedMessage={t("email.invalid")} />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("initial")}
            >
              {t("email.back")}
            </Button>
            <Button type="submit">{t("email.submit")}</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );

  const dialogContentInbox = () => (
    <>
      <DialogHeader>
        <DialogTitle>{t("inbox.title")}</DialogTitle>
        <DialogDescription>
          {t("inbox.preDescription")}
          <span className="font-bold"> {form.getValues("email")} </span>
          {t("inbox.postDescription")}
        </DialogDescription>
      </DialogHeader>
    </>
  );

  const dialogContent = {
    initial: dialogContentInitial,
    email: dialogContentEmail,
    inbox: dialogContentInbox,
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setStep("initial");
          toggleLoginModal("closed");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          onClick={() => {
            toggleLoginModal("open");
          }}
          className="relative rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-black dark:border-white/[0.2] dark:text-white"
        >
          <span>{t("trigger")}</span>
          <span className="absolute inset-x-0 -bottom-px mx-auto h-px w-1/2 bg-gradient-to-r from-transparent via-blue-500  to-transparent" />
        </button>
      </DialogTrigger>
      <DialogContent>{dialogContent[step]()}</DialogContent>
    </Dialog>
  );
}

export default SignUp;
