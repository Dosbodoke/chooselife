"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";

import type { Database } from "@/utils/supabase/database.types";
import { createSupabaseClient } from "@/utils/supabase/server";
import { createSupabaseServiceRoleClient } from "@/utils/supabase/service-role";

import {
  type NotificationFormData,
  notificationSchema,
} from "../[locale]/notifications/_components/validations";

type ActionResult = {
  success: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

function isAdminPassword(password: string) {
  const expected = process.env.NOTIFICATIONS_ADMIN_PASSWORD;
  // Unset means nobody can send, rather than an empty password being accepted.
  if (!expected) return false;

  // Hashing first gives equal-length buffers, so the comparison does not leak
  // the password's length or how many leading characters matched.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(password), digest(expected));
}

export async function sendNotification(
  data: NotificationFormData,
): Promise<ActionResult> {
  try {
    // Validate the data
    const validationResult = notificationSchema.safeParse(data);

    if (!validationResult.success) {
      const fieldErrors: Record<string, string[]> = {};
      validationResult.error.errors.forEach((error) => {
        const field = error.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(error.message);
      });

      return {
        success: false,
        error: "Dados inválidos",
        fieldErrors,
      };
    }

    const { password, userId, titleEn, titlePt, bodyEn, bodyPt } =
      validationResult.data;

    if (!isAdminPassword(password)) {
      return {
        success: false,
        error: "Senha inválida",
        fieldErrors: {
          password: ["Senha inválida"],
        },
      };
    }

    // Clients cannot insert notifications: every row is pushed to devices.
    const supabase = createSupabaseServiceRoleClient();

    // Prepare notification data
    const title = {
      en: titleEn?.trim() || undefined,
      pt: titlePt?.trim() || undefined,
    };

    const bodyText = {
      en: bodyEn?.trim() || undefined,
      pt: bodyPt?.trim() || undefined,
    };

    // Insert notification
    const { error } = await supabase.from("notifications").insert({
      title: title,
      body: bodyText,
      user_id: userId?.trim() || null,
    });

    if (error) {
      console.error("Error inserting notification:", error);
      return {
        success: false,
        error: "Falha ao enviar notificação",
      };
    }

    // Revalidate the notifications page to show updated data
    revalidatePath("/notifications");

    return {
      success: true,
      message: "Notificação enviada com sucesso!",
    };
  } catch (error) {
    console.error("Server action error:", error);
    return {
      success: false,
      error: "Erro interno do servidor",
    };
  }
}

export async function getRecentNotifications() {
  try {
    const supabase = await createSupabaseClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }

    return (
      (data as Array<
        Database["public"]["Tables"]["notifications"]["Row"]
      >) || []
    );
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return [];
  }
}
