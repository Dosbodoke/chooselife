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
  profile_id?: string;
}

// Type for the localized title/body objects
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

// Enhanced response interface for better tracking
interface NotificationResult {
  success: boolean;
  successfulSends: number;
  failedSends: number;
  invalidTokens: number;
  totalTargets: number;
  errors?: string[];
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Create a new Expo SDK client with better error handling
const expo = new Expo({
  // accessToken: Deno.env.get("EXPO_ACCESS_TOKEN"),
  useFcmV1: true,
});

// Fallback locale if user's locale is missing
const FALLBACK_LOCALE: Locales = "pt";

// Enhanced input validation
function validateEnvironmentVariables(): void {
  const required = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    // "EXPO_ACCESS_TOKEN",
  ];
  const missing = required.filter((key) => !Deno.env.get(key));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
}

function validateNotificationRecord(record: NotificationRecord): void {
  if (!record.id) {
    throw new Error("Notification record missing required 'id' field");
  }

  // Must have at least title or body
  if (!record.title && !record.body) {
    throw new Error("Notification must have at least a title or body");
  }

  // Validate localized text structure
  if (record.title && typeof record.title !== "object") {
    throw new Error("Title must be a localized object or null");
  }

  if (record.body && typeof record.body !== "object") {
    throw new Error("Body must be a localized object or null");
  }
}

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

// Enhanced token cleanup function
async function cleanupInvalidTokens(invalidTokens: string[]): Promise<void> {
  if (invalidTokens.length === 0) return;

  try {
    console.log(`Cleaning up ${invalidTokens.length} invalid tokens`);
    const { error } = await supabase
      .from("push_tokens")
      .delete()
      .in("token", invalidTokens);

    if (error) {
      console.error("Error cleaning up invalid tokens:", error);
    } else {
      console.log(
        `Successfully removed ${invalidTokens.length} invalid tokens`,
      );
    }
  } catch (error) {
    console.error("Failed to cleanup invalid tokens:", error);
  }
}

async function sendPushNotifications(
  targetTokens: PushTokenInfo[],
  notificationRecord: NotificationRecord,
): Promise<NotificationResult> {
  const messages: ExpoPushMessage[] = [];
  const invalidTokens: string[] = [];
  const errors: string[] = [];

  for (const tokenInfo of targetTokens) {
    const token: string = tokenInfo.token;

    // Check if the token is a valid Expo push token
    if (!Expo.isExpoPushToken(token)) {
      console.warn(
        `Invalid Expo push token: ${(token as string).substring(0, 10)}...`,
      );
      invalidTokens.push(token);
      continue;
    }

    const userLanguage = tokenInfo.language;
    const titleToSend = getLocalizedText(
      notificationRecord.title,
      userLanguage,
    );
    const bodyToSend = getLocalizedText(notificationRecord.body, userLanguage);

    // Only send if we have either title or body
    if (!titleToSend && !bodyToSend) {
      console.warn(
        `No localized content for token ${
          (token as string).substring(0, 10)
        }... with language ${userLanguage}`,
      );
      continue;
    }

    // Enhanced message construction with better error handling
    try {
      const message: ExpoPushMessage = {
        to: token,
        sound: "default" as const,
        priority: "high" as const,
        ...(titleToSend ? { title: titleToSend } : {}),
        ...(bodyToSend ? { body: bodyToSend } : {}),
        ...(notificationRecord.data ? { data: notificationRecord.data } : {}),
      };

      messages.push(message);
    } catch (error) {
      console.error(
        `Error constructing message for token ${
          (token as string).substring(0, 10)
        }...:`,
        error,
      );
      errors.push(`Message construction failed for token: ${error}`);
    }
  }

  // Clean up invalid tokens asynchronously (don't wait for it)
  if (invalidTokens.length > 0) {
    cleanupInvalidTokens(invalidTokens).catch(console.error);
  }

  if (messages.length === 0) {
    console.log("No valid messages to send.");
    return {
      success: true,
      successfulSends: 0,
      failedSends: 0,
      invalidTokens: invalidTokens.length,
      totalTargets: targetTokens.length,
      errors,
    };
  }

  // Chunk the messages for batch sending
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  console.log(
    `Sending ${messages.length} notifications in ${chunks.length} chunks`,
  );

  // Send chunks to Expo push notification service with enhanced error handling
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      console.log(
        `Sending chunk ${i + 1}/${chunks.length} with ${chunk.length} messages`,
      );
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);

      // Add small delay between chunks to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error(`Error sending chunk ${i + 1}:`, error);
      errors.push(`Chunk ${i + 1} failed: ${error}`);

      // Add failed chunk as error tickets
      for (let j = 0; j < chunk.length; j++) {
        tickets.push({
          status: "error",
          message: `Chunk send failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }
  }

  // Process tickets and create results with detailed logging
  let successfulSends = 0;
  let failedSends = 0;

  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === "ok") {
      successfulSends += 1;
    } else {
      failedSends += 1;
      console.warn(`Ticket ${i} failed:`, ticket);
      if (ticket.message) {
        errors.push(`Ticket failed: ${ticket.message}`);
      }
      if (ticket.details?.error) {
        errors.push(`Ticket error details: ${ticket.details.error}`);
      }
    }
  }

  console.log(
    `Notification results: ${successfulSends} successful, ${failedSends} failed, ${invalidTokens.length} invalid tokens`,
  );

  return {
    success: successfulSends > 0 ||
      (messages.length === 0 && targetTokens.length === 0),
    successfulSends,
    failedSends,
    invalidTokens: invalidTokens.length,
    totalTargets: targetTokens.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function fetchTargetTokens(
  notificationRecord: NotificationRecord,
): Promise<PushTokenInfo[]> {
  let targetTokens: PushTokenInfo[] = [];

  if (notificationRecord.user_id) {
    // Send to a specific user
    console.log(`Fetching tokens for user: ${notificationRecord.user_id}`);

    const { data, error } = await supabase
      .from("push_tokens")
      .select(`
        token,
        language,
        profile_id
      `)
      .eq("profile_id", notificationRecord.user_id);

    if (error) {
      console.error("Error fetching tokens for user:", error);
      throw new Error(`Failed to fetch user tokens: ${error.message}`);
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
    // Send to all users (broadcast)
    console.log("Fetching all push tokens for broadcast");

    const { data, error } = await supabase
      .from("push_tokens")
      .select(`
        token, 
        language,
        profile_id
      `);

    if (error) {
      console.error("Error fetching all push tokens:", error);
      throw new Error(`Failed to fetch broadcast tokens: ${error.message}`);
    }

    if (data && data.length > 0) {
      targetTokens = data;
      console.log(`Found ${targetTokens.length} push tokens for broadcast.`);
    } else {
      console.log("No push tokens found for broadcast.");
    }
  }

  return targetTokens;
}

Deno.serve(async (req) => {
  const startTime = Date.now();

  try {
    validateEnvironmentVariables();

    // Validate request method
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 405,
        },
      );
    }

    // Parse and validate payload
    let payload: WebhookPayload;
    try {
      payload = await req.json();
    } catch (error) {
      console.error("Invalid JSON payload:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON payload" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 400,
        },
      );
    }

    // Only process INSERT operations
    if (payload.type !== "INSERT") {
      console.log(`Ignoring ${payload.type} operation`);
      return new Response(
        JSON.stringify({ success: true, message: "Operation ignored" }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    const notificationRecord = payload.record;

    // Validate notification record
    validateNotificationRecord(notificationRecord);

    console.log(`Processing notification ID: ${notificationRecord.id}`);
    console.log(`Title:`, notificationRecord.title);
    console.log(`Body:`, notificationRecord.body);
    console.log(`Target user:`, notificationRecord.user_id || "BROADCAST");

    // Fetch target tokens
    const targetTokens = await fetchTargetTokens(notificationRecord);

    if (targetTokens.length === 0) {
      console.log(
        "No target tokens found. Notification completed with no sends.",
      );
      return new Response(
        JSON.stringify({
          success: true,
          successfulSends: 0,
          failedSends: 0,
          invalidTokens: 0,
          totalTargets: 0,
          message: "No target tokens found",
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 200,
        },
      );
    }

    // Send push notifications
    const result = await sendPushNotifications(
      targetTokens,
      notificationRecord,
    );

    const duration = Date.now() - startTime;
    console.log(`Notification processing completed in ${duration}ms`);
    console.log(`Final results:`, result);

    return new Response(
      JSON.stringify({
        ...result,
        processingTimeMs: duration,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: result.success ? 200 : 500,
      },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("Unhandled error in Edge Function:", error);

    let errorMessage = "An unexpected server error occurred.";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Provide more specific status codes for known error types
      if (error.message.includes("environment variables")) {
        statusCode = 500; // Server configuration error
      } else if (
        error.message.includes("Invalid") || error.message.includes("missing")
      ) {
        statusCode = 400; // Bad request
      }
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        processingTimeMs: duration,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: statusCode,
      },
    );
  }
});
