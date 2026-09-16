import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import {
  HIGHLINE_BEGINNER_GUIDE_CONTENT_DISPOSITION,
  HIGHLINE_BEGINNER_GUIDE_CONTENT_TYPE,
  resolveHighlineBeginnerAccess,
} from "@/lib/courses/highline-beginner-access";
import { r2Client } from "@/lib/storage/r2.server";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function createRlsSupabaseClient(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

function getPrivateGuideR2Config() {
  const bucket = process.env.HIGHLINE_BEGINNER_GUIDE_R2_BUCKET;
  const key = process.env.HIGHLINE_BEGINNER_GUIDE_R2_KEY;

  if (!bucket || !key) {
    throw new Error("Highline beginner guide R2 configuration is missing");
  }

  return { bucket, key };
}

export async function GET(request: NextRequest) {
  const result = await resolveHighlineBeginnerAccess(request, {
    authenticate: async (accessToken) => {
      const supabase = createRlsSupabaseClient(accessToken);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(accessToken);

      if (error || !user) {
        return null;
      }

      return { id: user.id };
    },
    hasEntitlement: async (accessToken, userId) => {
      const supabase = createRlsSupabaseClient(accessToken);
      const { data, error } = await supabase
        .from("choosen_course_entitlements")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data?.user_id === userId;
    },
    signDocument: async ({ contentDisposition, contentType, expiresIn }) => {
      const { bucket, key } = getPrivateGuideR2Config();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: contentDisposition,
        ResponseContentType: contentType,
      });

      return getSignedUrl(r2Client, command, { expiresIn });
    },
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: NO_STORE_HEADERS,
  });
}

export const dynamic = "force-dynamic";
