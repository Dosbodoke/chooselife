import { createClient, type User } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

import { createSupabaseClient } from "@/utils/supabase/server";

type Operation = "write" | "delete";

type BucketPolicy = {
  write: "user-scoped" | "authenticated" | "none";
  delete: "user-scoped" | "authenticated" | "none";
};

const BUCKET_POLICIES: Record<string, BucketPolicy> = {
  avatars: { write: "user-scoped", delete: "user-scoped" },
  images: { write: "authenticated", delete: "authenticated" },
  webbings: { write: "user-scoped", delete: "user-scoped" },
  promo: { write: "none", delete: "none" },
  documents: { write: "none", delete: "none" },
};

export async function getUser(request: NextRequest): Promise<User | null> {
  // Try Bearer token first (from Expo/mobile)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );
    const { data } = await supabase.auth.getUser(token);
    if (data.user) return data.user;
  }

  // Fall back to cookie-based auth (from web)
  const supabase = await createSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

type ValidationSuccess = {
  allowed: true;
  resolvedKey: string;
};

type ValidationFailure = {
  allowed: false;
  reason: string;
  status: number;
};

export function validateStorageRequest(
  user: User,
  bucket: string,
  key: string,
  operation: Operation
): ValidationSuccess | ValidationFailure {
  // Validate key is safe
  if (!key || key.includes("..") || key.startsWith("/")) {
    return { allowed: false, reason: "Invalid key", status: 400 };
  }

  const policy = BUCKET_POLICIES[bucket];
  if (!policy) {
    return { allowed: false, reason: "Invalid bucket", status: 400 };
  }

  const rule = policy[operation];

  if (rule === "none") {
    return {
      allowed: false,
      reason: `${operation} not allowed on this bucket`,
      status: 403,
    };
  }

  if (rule === "user-scoped") {
    if (operation === "write") {
      // Server prepends userId to enforce ownership
      return { allowed: true, resolvedKey: `${user.id}/${key}` };
    }

    // For delete, the key stored in DB already has the userId prefix
    // Verify the key belongs to this user
    if (!key.startsWith(`${user.id}/`)) {
      return {
        allowed: false,
        reason: "Access denied: you can only delete your own files",
        status: 403,
      };
    }
    return { allowed: true, resolvedKey: key };
  }

  // "authenticated" — any logged-in user, no prefix enforcement
  return { allowed: true, resolvedKey: key };
}
