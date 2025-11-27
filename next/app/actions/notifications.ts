"use server";

import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import type { Database } from "@/utils/supabase/database.types";

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

    // Check password
    if (password !== "cl.produssa") {
      return {
        success: false,
        error: "Senha inválida",
        fieldErrors: {
          password: ["Senha inválida"],
        },
      };
    }

    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      },
    );

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
    // Create Supabase client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      },
    );

    // Get recent notifications
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }

    return (data as Array<
      Database["public"]["Tables"]["notifications"]["Row"]
    >) || [];
  } catch (error) {
    console.error("Server action error:", error);
    return [];
  }
}
