import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextRequest, NextResponse } from "next/server";

import { r2Client, R2_BUCKET } from "@/lib/storage/r2.server";
import { getUser, validateStorageRequest } from "@/lib/storage/storage-auth.server";

export async function POST(request: NextRequest) {
  const user = await getUser(request);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { bucket, key, contentType } = body;

  if (!bucket || !key || !contentType) {
    return NextResponse.json(
      { error: "Missing bucket, key, or contentType" },
      { status: 400 }
    );
  }

  const validation = validateStorageRequest(user, bucket, key, "write");
  if (!validation.allowed) {
    return NextResponse.json(
      { error: validation.reason },
      { status: validation.status }
    );
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: `${bucket}/${validation.resolvedKey}`,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(r2Client, command, {
    expiresIn: 600, // 10 minutes
  });

  return NextResponse.json({ presignedUrl, key: validation.resolvedKey });
}
