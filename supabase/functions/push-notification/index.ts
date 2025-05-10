import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = string | number | boolean | null | {
  [key: string]: Json | undefined;
} | Json[];

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
  data: Json; // Optional data payload
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
    baseLocale && baseLocale !== preferredLanguage &&
    localizedObject[baseLocale]
  ) {
    return localizedObject[baseLocale];
  }

  // 3. Try the default locale ('en')
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

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();
  const notificationRecord = payload.record;

  console.log(`Received webhook for notification ID: ${notificationRecord.id}`);
  console.log(`Title Object:`, notificationRecord.title);
  console.log(`Body Object:`, notificationRecord.body);

  let targetTokens: PushTokenInfo[] = [];

  try {
    if (notificationRecord.user_id) {
      // --- Send to a specific user ---
      console.log(
        `Fetching tokens for user ID: ${notificationRecord.user_id}`,
      );

      // Query push_tokens table with a join to profiles to get language preference
      const { data: rawData, error } = await supabase
        .from("push_tokens")
        .select(`
          token,
          language,
        `)
        .eq("profile_id", notificationRecord.user_id);

      if (error) {
        console.error("Error fetching tokens for user:", error);
        throw error;
      }

      if (rawData && rawData.length > 0) {
        console.log(
          `Found ${rawData.length} tokens for user ${notificationRecord.user_id}`,
        );
        console.log("Raw data from database:", JSON.stringify(rawData));

        // Transform the data to match our expected structure
        targetTokens = rawData.map((item: any) => {
          console.log("Raw item structure:", JSON.stringify(item));

          const result = {
            token: item.token,
            language: item.language,
          };
          console.log("Transformed token info:", JSON.stringify(result));
          return result;
        });
      } else {
        console.warn(
          `No push tokens found for user ID: ${notificationRecord.user_id}`,
        );
      }
    } else {
      // --- Send to all users with a push token ---
      console.log("Fetching all push tokens with associated profiles");

      // Query all tokens with an optional join to profiles (some tokens may not have a profile)
      const { data: rawData, error } = await supabase
        .from("push_tokens")
        .select(`
          token, 
          language,
        `);

      if (error) {
        console.error("Error fetching all push tokens:", error);
        throw error;
      }

      if (rawData) {
        console.log("Raw data from database:", JSON.stringify(rawData));

        // Transform the data to match our expected structure
        targetTokens = rawData.map((item: any) => {
          console.log("Raw item structure:", JSON.stringify(item));

          const result = {
            token: item.token,
            language: item.language,
          };
          console.log("Transformed token info:", JSON.stringify(result));
          return result;
        });
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

    // --- Send Push Notifications via Expo ---
    const pushPromises = targetTokens.map(async (tokenInfo) => {
      const token = tokenInfo.token;
      const userLanguage = tokenInfo.language;

      console.log(
        `Processing notification for token with language preference: ${userLanguage}`,
      );

      const titleToSend = getLocalizedText(
        notificationRecord.title,
        userLanguage,
      );
      const bodyToSend = getLocalizedText(
        notificationRecord.body,
        userLanguage,
      );

      // Only send title/body if we actually resolved some text
      if (!titleToSend && !bodyToSend) {
        console.warn(
          `No suitable title or body found for language '${userLanguage}' (or fallback) for token ${
            token.substring(0, 10)
          }... Skipping.`,
        );
        return {
          token: token.substring(0, 10) + "...",
          success: false,
          skipped: true,
          reason: "No content found for language",
        };
      }

      const message = {
        to: token,
        sound: "default",
        ...(titleToSend ? { title: titleToSend } : {}),
        ...(bodyToSend ? { body: bodyToSend } : {}),
        ...(notificationRecord.data ? { data: notificationRecord.data } : {}),
      };

      console.log(`Sending message to Expo:`, JSON.stringify(message));

      try {
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Accept-Encoding": "gzip, deflate",
            // "Authorization": `Bearer ${Deno.env.get("EXPO_ACCESS_TOKEN")}`,
          },
          body: JSON.stringify(message),
        });

        const result = await res.json();
        console.log(
          `Expo response for token ${token.substring(0, 10)}...:`,
          result,
        );
        const wasSent = result?.data?.status === "ok";
        return {
          token: token.substring(0, 10) + "...",
          success: wasSent,
          skipped: false,
          response: result,
        };
      } catch (fetchError) {
        console.error(
          `Error sending push notification to token ${
            token.substring(0, 10)
          }...:`,
          fetchError,
        );
        let errorMessage =
          "An unknown error occurred while sending the push notification.";
        if (fetchError instanceof Error) {
          errorMessage = fetchError.message;
        } else if (typeof fetchError === "string") {
          errorMessage = fetchError;
        }
        return {
          token: token.substring(0, 10) + "...",
          success: false,
          skipped: false,
          error: errorMessage,
        };
      }
    });

    const results = await Promise.all(pushPromises);
    const successfulSends = results.filter((r) =>
      r.success && !r.skipped
    ).length;
    const skippedSends = results.filter((r) => r.skipped).length;

    console.log(
      `Finished sending. Successful: ${successfulSends}, Skipped (no content): ${skippedSends}, Failed: ${
        results.length - successfulSends - skippedSends
      } / Total Targets: ${results.length}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        sent_count: successfulSends,
        skipped_count: skippedSends,
        total_targets: results.length,
        results: results,
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
