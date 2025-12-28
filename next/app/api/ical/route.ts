import { NextRequest, NextResponse } from "next/server";

/**
 * API route to proxy iCal requests to avoid CORS issues
 * 
 * Usage: GET /api/ical?url=<encoded-ical-url>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 }
    );
  }

  // Validate that the URL is a Google Calendar iCal URL
  if (!url.startsWith("https://calendar.google.com/calendar/ical/")) {
    return NextResponse.json(
      { error: "Only Google Calendar iCal URLs are allowed" },
      { status: 403 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Chooselife/1.0",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch calendar: ${response.statusText}` },
        { status: response.status }
      );
    }

    const icalData = await response.text();

    return new NextResponse(icalData, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("Failed to proxy iCal request:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar data" },
      { status: 500 }
    );
  }
}
