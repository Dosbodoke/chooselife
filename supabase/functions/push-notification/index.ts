// https://supabase.com/docs/guides/functions/examples/push-notifications?queryGroups=platform&platform=expo

import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = string | number | boolean | null | {
  [key: string]: Json | undefined;
} | Json[];

interface Notification {
  id: string;
  user_id: string | null;
  title: string | null;
  body: string | null;
  data: Json;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Notification;
  schema: "public";
  old_record: null | Notification;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();

  let expoPushTokens: string[] = [];

  if (payload.record.user_id) {
    // Send to a specific user
    const { data } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .eq("id", payload.record.user_id)
      .single();

    if (data?.expo_push_token) {
      expoPushTokens.push(data.expo_push_token);
    }
  } else {
    // Send to all users with expo_push_token
    const { data } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .not("expo_push_token", "is", null);

    if (data) {
      expoPushTokens = data;
    }
  }

  const pushPromises = expoPushTokens.map(async (token) => {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // https://supabase.com/docs/guides/functions/examples/push-notifications?queryGroups=platform&platform=expo#enhanced-security-for-push-notifications
        // Authorization: `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}`,
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        ...(payload.record.title ? { title: payload.record.title } : {}),
        ...(payload.record.body ? { body: payload.record.body } : {}),
        ...(payload.record.data ? { data: payload.record.data } : {}),
      }),
    });

    return await res.json();
  });

  const results = await Promise.all(pushPromises);

  return new Response(
    JSON.stringify({
      success: true,
      sent_count: results.filter(Boolean).length,
      results: results,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
