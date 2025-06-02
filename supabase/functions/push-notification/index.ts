import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import {
  Expo,
  ExpoPushMessage,
  ExpoPushTicket,
} from "npm:expo-server-sdk@3.15.0";

type Locales = "pt" | "en";

// Structure for token data fetched from Supabase
interface PushTokenInfo {
  token: string;
  language: Locales | null;
}

// Type for the localized title/body objects
// Allows 'en', 'pt', and potentially other string keys
type LocalizedText = Record<Locales, string> | null;

interface NotificationRecord {
  id: string;
  user_id: string | null; // Target user ID, or null for broadcast
  title: LocalizedText; // e.g., { "en": "Hello", "pt": "Olá" } || null
  body: LocalizedText; // e.g., { "en": "Body", "pt": "Corpo" } || null
  data: Record<string, string>; // Optional data payload
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: NotificationRecord;
  schema: "public";
  old_record: null | NotificationRecord;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Create a new Expo SDK client
const expo = new Expo({
  accessToken: Deno.env.get("EXPO_ACCESS_TOKEN"),
  useFcmV1: true,
});

// Fallback locale if user's locale is missing
const FALLBACK_LOCALE: Locales = "pt";

function getLocalizedText(
  localizedObject: LocalizedText,
  preferredLanguage: Locales | null | undefined,
): string | null {
  if (!localizedObject || typeof localizedObject !== "object") {
    return null; // Input is null or not an object
  }

  // 1. Try the preferred locale (if provided)
  if (preferredLanguage && localizedObject[preferredLanguage]) {
    return localizedObject[preferredLanguage];
  }

  // 2. Try the base part of the preferred locale (e.g., 'pt' from 'pt-BR')
  const baseLocale = preferredLanguage?.split("-")[0] as Locales;
  if (
    baseLocale &&
    baseLocale !== preferredLanguage &&
    localizedObject[baseLocale]
  ) {
    return localizedObject[baseLocale];
  }

  // 3. Try the default locale ('pt')
  if (localizedObject[FALLBACK_LOCALE]) {
    return localizedObject[FALLBACK_LOCALE];
  }

  // 4. As a last resort, try to return *any* translation available
  const availableLocales = Object.keys(localizedObject) as Locales[];
  if (availableLocales.length > 0) {
    return localizedObject[availableLocales[0]];
  }

  // 5. If no text is found
  return null;
}

async function sendPushNotifications(
  targetTokens: PushTokenInfo[],
  notificationRecord: NotificationRecord,
) {
  const messages: ExpoPushMessage[] = [];

  for (const tokenInfo of targetTokens) {
    // Check if the token is a valid Expo push token
    const token = tokenInfo.token;
    if (!Expo.isExpoPushToken(token)) {
      continue;
    }

    const userLanguage = tokenInfo.language;
    const titleToSend = getLocalizedText(
      notificationRecord.title,
      userLanguage,
    );
    const bodyToSend = getLocalizedText(notificationRecord.body, userLanguage);

    // Only send title/body if we actually resolved some text
    if (!titleToSend && !bodyToSend) {
      continue;
    }

    messages.push({
      to: token,
      sound: "default" as const,
      ...(titleToSend ? { title: titleToSend } : {}),
      ...(bodyToSend ? { body: bodyToSend } : {}),
      ...(notificationRecord.data ? { data: notificationRecord.data } : {}),
    });
  }

  if (messages.length === 0) {
    console.log("No valid messages to send.");
    return;
  }

  // Chunk the messages for batch sending
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  console.log(
    `Sending ${messages.length} notifications in ${chunks.length} chunks`,
  );

  // Send chunks to Expo push notification service
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error(`Error sending chunk:`, error);
    }
  }

  // Process tickets and create results
  let successfulSends = 0;
  let failedSends = 0;
  for (const ticket of tickets) {
    if (ticket.status === "ok") {
      successfulSends += 1;
    } else {
      failedSends += 1;
    }
  }

  return { successfulSends, failedSends };
}

Deno.serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();
    const notificationRecord = payload.record;

    console.log(
      `Received webhook for notification ID: ${notificationRecord.id}`,
    );
    console.log(`Title Object:`, notificationRecord.title);
    console.log(`Body Object:`, notificationRecord.body);

    let targetTokens: PushTokenInfo[] = [];

    if (notificationRecord.user_id) {
      // Send to a specific user
      const { data, error } = await supabase
        .from("push_tokens")
        .select(
          `
          token,
          language
        `,
        )
        .eq("profile_id", notificationRecord.user_id);

      if (error) {
        console.error("Error fetching tokens for user:", error);
        throw error;
      }

      if (data && data.length > 0) {
        console.log(
          `Found ${data.length} tokens for user ${notificationRecord.user_id}`,
        );
        targetTokens = data;
      } else {
        console.warn(
          `No push tokens found for user ID: ${notificationRecord.user_id}`,
        );
      }
    } else {
      // Send to all users
      const { data, error } = await supabase.from("push_tokens").select(`
          token, 
          language
        `);

      if (error) {
        console.error("Error fetching all push tokens:", error);
        throw error;
      }

      if (data && data.length > 0) {
        targetTokens = data;
        console.log(`Found ${targetTokens.length} push tokens.`);
      } else {
        console.log("No push tokens found.");
      }
    }

    if (targetTokens.length === 0) {
      console.log("No target tokens for push notification. Exiting.");
      return new Response(
        JSON.stringify({ success: true, sent_count: 0, results: [] }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Send push notifications using Expo SDK
    const result = await sendPushNotifications(
      targetTokens,
      notificationRecord,
    );

    console.log(
      `Finished sending. Successful: ${result?.successfulSends}, Failed: ${result?.failedSends}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        successfulSends: result?.successfulSends,
        failedSends: result?.failedSends,
      }),
      { headers: { "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("Unhandled error in Edge Function:", error);
    let errorMessage = "An unexpected server error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
