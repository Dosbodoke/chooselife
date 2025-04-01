"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { deleteAccount } from "@/app/actions/deleteAccount";
import { LoadingIcon } from "@/assets";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import useSupabaseBrowser from "@/utils/supabase/client";

export default function DeleteAccountPage() {
  const supabase = useSupabaseBrowser();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const t = useTranslations("deleteAccount");

  const handleDeleteRequest = async () => {
    setIsDeleting(true);
    setError(null);

    const result = await deleteAccount();

    if (result.error) {
      setError(result.error);
      setIsDeleting(false);
    } else if (result.success) {
      // Show success message and redirect after a short delay
      alert(t("successMessage"));
      setTimeout(() => router.push("/"), 2000);
    }
  };

  useEffect(() => {
    async function setUsername() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setLoading(false);
      } else router.replace("/");
    }
    setUsername();
  }, [router, supabase.auth]);

  if (loading)
    return (
      <div className="grid h-full w-full place-items-center">
        <div className="h-16 w-16">
          <LoadingIcon className="animate-spin" />
        </div>
      </div>
    );

  return (
    <div className="container mx-auto p-4">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-500">{t("info")}</p>
          {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => router.back()}>
            {t("cancelButton")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteRequest}
            disabled={isDeleting}
          >
            {isDeleting ? t("processingButton") : t("deleteButton")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
