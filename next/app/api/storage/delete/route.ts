import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

import { r2Client, R2_BUCKET } from "@/lib/storage/r2.server";
import { getUser, validateStorageRequest } from "@/lib/storage/storage-auth.server";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { bucket, key } = body;

    if (!bucket || !key) {
      return NextResponse.json(
        { error: "Missing bucket or key" },
        { status: 400 }
      );
    }

    const validation = validateStorageRequest(user, bucket, key, "delete");
    if (!validation.allowed) {
      return NextResponse.json(
        { error: validation.reason },
        { status: validation.status }
      );
    }

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET,
        Key: `${bucket}/${validation.resolvedKey}`,
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
