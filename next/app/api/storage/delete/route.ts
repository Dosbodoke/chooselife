import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

import { r2Client, R2_BUCKET } from "@/lib/r2.server";
import { createSupabaseClient } from "@/utils/supabase/server";

const ALLOWED_BUCKETS = ["images", "avatars", "promo", "documents", "webbings"];

async function getUser(request: NextRequest) {
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

  const supabase = await createSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { bucket, key } = body;

  if (!bucket || !key) {
    return NextResponse.json(
      { error: "Missing bucket or key" },
      { status: 400 }
    );
  }

  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: `${bucket}/${key}`,
    })
  );

  return NextResponse.json({ success: true });
}
