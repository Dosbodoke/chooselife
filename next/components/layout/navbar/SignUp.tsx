"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
import { signInWithEmailPassword } from "@/utils/auth/sign-in";
import { supabaseBrowser } from "@/utils/supabase/client";
import { useLoginModal } from "@/utils/useLoginModal";

const formSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormSchema = z.infer<typeof formSchema>;

function SignUp() {
  const supabase = supabaseBrowser();
  const t = useTranslations("login");
  const router = useRouter();
  const { open, toggleLoginModal } = useLoginModal();

  const [step, setStep] = useState<"initial" | "email">("initial");
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
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

  async function signInWithPassword(data: FormSchema) {
    form.clearErrors("root");
    const result = await signInWithEmailPassword(supabase.auth, data);

    if (!result.success) {
      form.setError("root", {
        message:
          result.reason === "invalid_credentials"
            ? t("email.invalidCredentials")
            : t("email.loginError"),
      });
      return;
    }

    form.reset();
    setStep("initial");
    toggleLoginModal("closed");
    router.refresh();
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
        <form
          onSubmit={form.handleSubmit(signInWithPassword)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder={t("email.placeholder")}
                    type="email"
                    autoComplete="email"
                    disabled={form.formState.isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage translatedMessage={t("email.invalid")} />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder={t("email.passwordPlaceholder")}
                    type="password"
                    autoComplete="current-password"
                    disabled={form.formState.isSubmitting}
                    {...field}
                  />
                </FormControl>
                <FormMessage translatedMessage={t("email.passwordRequired")} />
              </FormItem>
            )}
          />
          {form.formState.errors.root?.message ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={form.formState.isSubmitting}
              onClick={() => {
                form.reset();
                setStep("initial");
              }}
            >
              {t("email.back")}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? t("email.submitting")
                : t("email.submit")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );

  const dialogContent = {
    initial: dialogContentInitial,
    email: dialogContentEmail,
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        if (!open) {
          setStep("initial");
          form.reset();
          toggleLoginModal("closed");
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          onClick={() => {
            toggleLoginModal("open");
          }}
          className="relative rounded-full border border-neutral-200 bg-background px-4 py-2 text-sm font-medium text-black corner-squircle dark:border-white/[0.2] dark:text-white"
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
