"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SendIcon, CheckCircleIcon, XCircleIcon, BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { notificationSchema, type NotificationFormData } from "./validations";

import type { Database } from "@/utils/supabase/database.types";
import {
  getRecentNotifications,
  sendNotification,
} from "@/app/actions/notifications";

import { UserPicker } from "@/components/user-picker";

type TNotification = Database["public"]["Tables"]["notifications"]["Row"];

type AlertState = {
  show: boolean;
  type: "success" | "error";
  message: string;
} | null;

export default function NotificationsForm({
  initialNotifications,
}: {
  initialNotifications: Array<TNotification>;
}) {
  const [isPending, startTransition] = useTransition();
  const [notifications, setNotifications] =
    useState<Array<TNotification>>(initialNotifications);
  const [alert, setAlert] = useState<AlertState>(null);

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      password: "",
      userId: "",
      titleEn: "",
      titlePt: "",
      bodyEn: "",
      bodyPt: "",
    },
  });

  const showAlert = (type: "success" | "error", message: string) => {
    setAlert({ show: true, type, message });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setAlert(null);
    }, 5000);
  };

  const onSubmit = async (data: NotificationFormData) => {
    setAlert(null); // Clear any existing alerts

    startTransition(async () => {
      try {
        const result = await sendNotification(data);

        if (!result.success) {
          // Handle field errors
          if (result.fieldErrors) {
            Object.entries(result.fieldErrors).forEach(([field, errors]) => {
              form.setError(field as keyof NotificationFormData, {
                message: errors[0],
              });
            });
          }

          // Show general error alert
          if (result.error) {
            showAlert("error", result.error);
          }
          return;
        }

        // Success
        showAlert(
          "success",
          result.message || "Notificação enviada com sucesso!"
        );

        // Reset form
        form.reset();

        // Refresh notifications list
        await refreshNotifications();
      } catch (error) {
        console.error("Error sending notification:", error);
        showAlert("error", "Erro ao enviar notificação. Tente novamente.");
      }
    });
  };

  const refreshNotifications = async () => {
    try {
      const updatedNotifications = await getRecentNotifications();
      setNotifications(updatedNotifications);
    } catch (error) {
      console.error("Error refreshing notifications:", error);
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
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Senha <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Senha da staff"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Usuário (Mandar para alguém específico)
                      </FormLabel>
                      <FormControl>
                        <UserPicker
                          defaultValue={field.value ? [field.value] : []}
                          onValueChange={(_, usersID) => {
                            field.onChange(usersID[0] || "");
                          }}
                          placeholder={"username"}
                          // placeholder={t("witness.placeholder")}
                          variant="secondary"
                          maxSelection={1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FormLabel className="text-base font-semibold">
                      Título
                    </FormLabel>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="titlePt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Português <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Título da notificação em português"
                              maxLength={65}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>(máx. 65 chars)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="titleEn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>English</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Notification title in English"
                              maxLength={65}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>Max. 65 characters</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <FormLabel className="text-base font-semibold">
                      Mensagem
                    </FormLabel>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="bodyPt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Português <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Mensagem da notificação em português"
                              rows={3}
                              maxLength={150}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>(máx. 150 chars)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="bodyEn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>English</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Notification message in English"
                              rows={3}
                              maxLength={150}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>(Max. 150 chars)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  <SendIcon className="mr-2 h-4 w-4" />
                  {isPending ? "Enviando..." : "Enviar"}
                </Button>

                {/* Confirmation Alert */}
                {alert && (
                  <Alert
                    className={`mt-4 ${
                      alert.type === "success"
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {alert.type === "success" ? (
                        <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircleIcon className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription
                        className={
                          alert.type === "success"
                            ? "text-green-800"
                            : "text-red-800"
                        }
                      >
                        {alert.message}
                      </AlertDescription>
                    </div>
                  </Alert>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notificações Recentes</CardTitle>
            <CardDescription>Última 5 notificações enviadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                Nenhuma notificação ainda.
              </p>
            ) : (
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <AppNotification
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const AppNotification: React.FC<{ notification: TNotification }> = ({
  notification,
}) => (
  <div className="relative overflow-hidden rounded-2xl bg-card shadow-lg shadow-primary-foreground">
    {/* iOS notification header bar */}
    <div className="flex h-8 items-center justify-between bg-secondary/80 px-3">
      <div className="flex items-center gap-1">
        <span className="text-xs font-semibold">
          {notification.user_id
            ? `Enviado para: ${notification.user_id}`
            : "Enviado para todos"}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">
        {formatTimeAgo(notification.created_at)}
      </span>
    </div>

    {/* iOS notification content */}
    <div className="flex gap-3 p-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sm">
        <BellIcon className="h-6 w-6" />
      </div>

      <div className="flex-1 gap-1 py-1">
        <p className="font-semibold leading-tight text-accent-foreground">
          {notification.title?.pt || notification.title?.en || "Chooselife"}
        </p>
        <p className="line-clamp-2 text-sm text-card-foreground">
          {notification.body?.pt || notification.body?.en || ""}
        </p>
      </div>
    </div>
    <div className="absolute left-0 top-8 h-full w-1 bg-sky-500" />
  </div>
);

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `hà ${diffMins}m`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `hà ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `hà ${diffDays}d`;

  return date.toLocaleDateString();
};
