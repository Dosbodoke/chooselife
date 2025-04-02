// https://supabase.com/docs/guides/functions/examples/push-notifications?queryGroups=platform&platform=expo

import { createClient } from "jsr:@supabase/supabase-js@2";

type Json = string | number | boolean | null | {
  [key: string]: Json | undefined;
} | Json[];

type Locales = "pt" | "en";

// Structure for user profile data fetched from Supabase
interface UserProfile {
  expo_push_token: string;
  language: Locales | null;
}

// Type for the localized title/body objects
// Allows 'en', 'pt', and potentially other string keys
type LocalizedText = null | Record<Locales, string>;

interface NotificationRecord {
  id: string;
  user_id: string | null; // Target user ID, or null for broadcast
  title: LocalizedText; // e.g., { "en": "Hello", "pt": "Olá" } or null
  body: LocalizedText; // e.g., { "en": "Body", "pt": "Corpo" } or null
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

const FALLBACK_LOCALE: Locales = "pt"; // Fallback locale if user's locale is missing in the title/body object

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

  // 3. Try the default locale ('pt-BR')
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

  let targetProfiles: UserProfile[] = [];

  try {
    if (notificationRecord.user_id) {
      // --- Send to a specific user ---
      console.log(
        `Workspaceing profile for user ID: ${notificationRecord.user_id}`,
      );
      const { data, error } = await supabase
        .from("profiles")
        .select("expo_push_token, language")
        .eq("id", notificationRecord.user_id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching single profile:", error);
        throw error;
      }

      if (data?.expo_push_token) {
        console.log(
          `Found profile for ${notificationRecord.user_id}. Language: ${data.language}, Token: ${
            data.expo_push_token.substring(0, 10)
          }...`,
        );
        targetProfiles.push({
          expo_push_token: data.expo_push_token,
          language: data.language,
        });
      } else {
        console.warn(
          `No valid profile or push token found for user ID: ${notificationRecord.user_id}`,
        );
      }
    } else {
      // --- Send to all users with an expo_push_token ---
      console.log("Fetching all profiles with push tokens.");
      const { data, error } = await supabase
        .from("profiles")
        .select("expo_push_token, language")
        .not("expo_push_token", "is", null);

      if (error) {
        console.error("Error fetching all profiles:", error);
        throw error;
      }

      if (data) {
        targetProfiles = data;
        console.log(`Found ${targetProfiles.length} profiles with tokens.`);
      } else {
        console.log("No profiles found with push tokens.");
      }
    }

    if (targetProfiles.length === 0) {
      console.log("No target users for push notification. Exiting.");
      return new Response(
        JSON.stringify({ success: true, sent_count: 0, results: [] }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // --- Send Push Notifications via Expo ---
    const pushPromises = targetProfiles.map(async (profile) => {
      const token = profile.expo_push_token;
      const userLanguage = profile.language;

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

      console.log(
        `Sending push to token ${
          token.substring(0, 10)
        }... (Language: ${userLanguage}). Title: ${titleToSend}, Body: ${bodyToSend}`,
      );

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
        return {
          token: token.substring(0, 10) + "...",
          success: false,
          skipped: false,
          error: fetchError.message,
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
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { "Content-Type": "application/json" }, status: 500 },
    );
  }
});
