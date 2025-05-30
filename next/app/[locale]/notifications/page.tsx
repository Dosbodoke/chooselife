import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

import { useSupabaseServer } from "@/utils/supabase/server";
import type { Database } from "@/utils/supabase/database.types";

import { Send } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

async function sendNotification(formData: FormData) {
  "use server";

  const supabase = await useSupabaseServer();

  const userId = formData.get("userId") as string;
  const titleEn = formData.get("titleEn") as string;
  const titlePt = formData.get("titlePt") as string;
  const bodyEn = formData.get("bodyEn") as string;
  const bodyPt = formData.get("bodyPt") as string;
  const password = formData.get("password") as string;

  const createErrorRedirectUrl = (
    errorCode: string,
    currentFormData: FormData,
    additionalParams?: Record<string, string | number>
  ) => {
    const params = new URLSearchParams();
    params.append("error", errorCode);

    currentFormData.forEach((value, key) => {
      if (key !== "password") {
        params.append(key, value.toString());
      }
    });

    if (additionalParams) {
      for (const [key, value] of Object.entries(additionalParams)) {
        params.append(key, value.toString());
      }
    }
    return `/notifications?${params.toString()}`;
  };

  if (password !== "cl.produssa") {
    redirect(createErrorRedirectUrl("invalid_password", formData));
  }

  if (!titlePt.trim() && !bodyPt.trim()) {
    redirect(createErrorRedirectUrl("portuguese_required", formData));
  }

  if (!titleEn.trim() && !titlePt.trim() && !bodyEn.trim() && !bodyPt.trim()) {
    redirect(createErrorRedirectUrl("content_required", formData));
  }

  const validateLength = (
    text: string,
    maxLength: number,
    fieldName: string,
    currentFormData: FormData
  ) => {
    if (text && text.trim().length > maxLength) {
      redirect(
        createErrorRedirectUrl(`length_${fieldName}`, currentFormData, {
          length: text.trim().length,
          max: maxLength,
        })
      );
    }
  };

  if (titleEn.trim()) validateLength(titleEn.trim(), 65, "title_en", formData);
  if (titlePt.trim()) validateLength(titlePt.trim(), 65, "title_pt", formData);

  if (bodyEn.trim()) validateLength(bodyEn.trim(), 240, "body_en", formData);
  if (bodyPt.trim()) validateLength(bodyPt.trim(), 240, "body_pt", formData);

  const validateCombinedLength = (
    title: string,
    body: string,
    language: string,
    currentFormData: FormData
  ) => {
    const combinedLength = (title.trim() + body.trim()).length;
    if (combinedLength > 150) {
      redirect(
        createErrorRedirectUrl(`combined_length_${language}`, currentFormData, {
          length: combinedLength,
          max: 150,
        })
      );
    }
  };

  if (titleEn.trim() || bodyEn.trim()) {
    validateCombinedLength(titleEn, bodyEn, "en", formData);
  }
  if (titlePt.trim() || bodyPt.trim()) {
    validateCombinedLength(titlePt, bodyPt, "pt", formData);
  }

  const title = {
    en: titleEn.trim() || undefined,
    pt: titlePt.trim() || undefined,
  };

  const body = {
    en: bodyEn.trim() || undefined,
    pt: bodyPt.trim() || undefined,
  };

  try {
    const { error } = await supabase.from("notifications").insert({
      title: title,
      body: body,
      user_id: userId || null,
    });

    if (error) {
      console.error("Error inserting notification:", error);
      redirect(createErrorRedirectUrl("send_failed", formData));
    }

    revalidatePath("/notifications");
    redirect("/notifications?success=true");
  } catch (error) {
    console.error("Database error:", error);
    redirect(createErrorRedirectUrl("send_failed", formData));
  }
}

async function getRecentNotifications(supabase: SupabaseClient<Database>) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }

  return data || [];
}

interface NotificationsPageProps {
  searchParams: Promise<{
    error?: string;
    success?: string;
    length?: string;
    max?: string;
    userId?: string;
    titleEn?: string;
    titlePt?: string;
    bodyEn?: string;
    bodyPt?: string;
  }>;
}

export default async function NotificationsPage({
  searchParams: searchParamsPromise,
}: NotificationsPageProps) {
  const supabase = await useSupabaseServer();
  const recentNotifications = await getRecentNotifications(supabase);
  const params = await searchParamsPromise;

  const getErrorMessage = (error: string, length?: string, max?: string) => {
    const lengthInfo = length && max ? ` (${length}/${max} caracteres)` : "";

    switch (true) {
      case error === "invalid_password":
        return "Senha inválida";
      case error === "portuguese_required":
        return "É necessário preencher pelo menos um campo em português (título ou mensagem)";
      case error === "content_required":
        return "Pelo menos um campo de título ou mensagem deve ser preenchido";
      case error === "send_failed":
        return "Falha ao enviar notificação";
      case error.startsWith("length_title_"):
        const lang = error.includes("_en") ? "inglês" : "português";
        return `Título em ${lang} muito longo${lengthInfo}. Máximo: 65 caracteres (Android)`;
      case error.startsWith("length_body_"):
        const bodyLang = error.includes("_en") ? "inglês" : "português";
        return `Mensagem em ${bodyLang} muito longa${lengthInfo}. Máximo: 240 caracteres (Android)`;
      case error.startsWith("combined_length_"):
        const combinedLang = error.includes("_en") ? "inglês" : "português";
        return `Título + mensagem em ${combinedLang} muito longo${lengthInfo}. Máximo: 150 caracteres (iOS)`;
      default:
        return "Ocorreu um erro ao enviar a notificação";
    }
  };

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Push Notifications</h1>
        <p className="text-muted-foreground">
          Envie notificação para todos no aplicativo.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            {params.success && (
              <div className="mb-6 rounded-lg bg-green-50 p-4 text-green-800">
                <p className="text-sm font-medium">
                  Notification sent successfully!
                </p>
              </div>
            )}

            {params.error && (
              <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
                <p className="text-sm font-medium">
                  {getErrorMessage(params.error, params.length, params.max)}
                </p>
              </div>
            )}

            <form action={sendNotification} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Senha <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Senha da staff"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userId">
                  User ID (for specific user targeting)
                </Label>
                <Input
                  id="userId"
                  name="userId"
                  placeholder="Enter user ID"
                  className="font-mono text-sm"
                  defaultValue={params.userId || ""}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">Título</Label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="titlePt">
                      Português <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="titlePt"
                      name="titlePt"
                      placeholder="Título da notificação em português"
                      maxLength={65}
                      defaultValue={params.titlePt || ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      (máx. 65 chars)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="titleEn">English</Label>
                    <Input
                      id="titleEn"
                      name="titleEn"
                      placeholder="Notification title in English"
                      maxLength={65}
                      defaultValue={params.titleEn || ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      Max. 65 characters
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">Mensagem</Label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bodyPt">
                      Português <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="bodyPt"
                      name="bodyPt"
                      placeholder="Mensagem da notificação em português"
                      rows={3}
                      maxLength={240}
                      defaultValue={params.bodyPt || ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      (máx. 240 chars)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bodyEn">English</Label>
                    <Textarea
                      id="bodyEn"
                      name="bodyEn"
                      placeholder="Notification message in English"
                      rows={3}
                      maxLength={240}
                      defaultValue={params.bodyEn || ""}
                    />
                    <p className="text-xs text-muted-foreground">
                      (Max. 240 chars)
                    </p>
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Enviar
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificações Recentes</CardTitle>
            <CardDescription>Última 5 notificações enviadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentNotifications.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhuma notificação ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {recentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="space-y-2 rounded-lg border p-4"
                  >
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={notification.user_id ? "default" : "secondary"}
                      >
                        {notification.user_id ? "User" : "Broadcast"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {notification.title?.en ||
                          notification.title?.pt ||
                          "No title"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {notification.body?.en ||
                          notification.body?.pt ||
                          "No message"}
                      </p>
                    </div>

                    {notification.user_id && (
                      <p className="font-mono text-xs text-muted-foreground">
                        User: {notification.user_id}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
