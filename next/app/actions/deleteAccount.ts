"use server";

import { type CookieOptions, createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import type { Database } from "@/utils/supabase/database.types";

export async function deleteAccount() {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "User not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ deletion_requested: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("Error marking account for deletion:", error);
    return { error: "Failed to process deletion request" };
  }

  await supabase.auth.signOut();

  revalidatePath("/");

  return { success: true };
}
