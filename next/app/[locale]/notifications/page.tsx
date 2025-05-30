import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

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

  try {
    const supabase = await useSupabaseServer();

    const userId = formData.get("userId") as string;
    const titleEn = formData.get("titleEn") as string;
    const titlePt = formData.get("titlePt") as string;
    const bodyEn = formData.get("bodyEn") as string;
    const bodyPt = formData.get("bodyPt") as string;
    const password = formData.get("password") as string;

    // Validate password
    if (password !== "cl.produza") {
      throw new Error("Invalid password");
    }

    // Build localized title and body objects
    const title = {
      en: titleEn.trim() || undefined,
      pt: titlePt.trim() || undefined,
    };

    const body = {
      en: bodyEn.trim() || undefined,
      pt: bodyPt.trim() || undefined,
    };

    // Insert notification record into Supabase
    const { error } = await supabase.from("notifications").insert({
      title: title,
      body: body,
      user_id: userId || null,
    });

    if (error) {
      console.error("Error inserting notification:", error);
      throw new Error("Failed to send notification");
    }

    revalidatePath("/notifications");
  } catch (error) {
    console.error("Notification send error:", error);
    // In a real app, you might want to handle this more gracefully
    // For now, we'll just let the error bubble up
    throw error;
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

export default async function NotificationsPage() {
  const supabase = await useSupabaseServer();
  const recentNotifications = await getRecentNotifications(supabase);

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Push Notifications</h1>
        <p className="text-muted-foreground">
          Envie notificação para todos no aplicativo.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Send Notification Form */}
        <Card>
          <CardContent className="pt-4">
            <form action={sendNotification} className="space-y-6">
              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Senha da staff"
                  required
                />
              </div>

              {/* User ID Input (conditional) */}
              <div className="space-y-2">
                <Label htmlFor="userId">
                  User ID (for specific user targeting)
                </Label>
                <Input
                  id="userId"
                  name="userId"
                  placeholder="Enter user ID"
                  className="font-mono text-sm"
                />
              </div>

              {/* Title Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">Título</Label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="titleEn">English</Label>
                    <Input
                      id="titleEn"
                      name="titleEn"
                      placeholder="Notification title in English"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="titlePt">Português</Label>
                    <Input
                      id="titlePt"
                      name="titlePt"
                      placeholder="Título da notificação em português"
                    />
                  </div>
                </div>
              </div>

              {/* Body Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-semibold">Mensagem</Label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="bodyEn">English</Label>
                    <Textarea
                      id="bodyEn"
                      name="bodyEn"
                      placeholder="Notification message in English"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bodyPt">Português</Label>
                    <Textarea
                      id="bodyPt"
                      name="bodyPt"
                      placeholder="Mensagem da notificação em português"
                      rows={3}
                    />
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

        {/* Recent Notifications */}
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
