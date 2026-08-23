import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { after, before, test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nextDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const port = 3217;
const baseUrl = `http://127.0.0.1:${port}`;
let server;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function visibleText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasVaryHeader(response, value) {
  return (response.headers.get("vary") || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .includes(value.toLowerCase());
}

before(async () => {
  server = spawn("pnpm", ["start"], {
    cwd: nextDirectory,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "example-key",
      NEXT_PUBLIC_BASE_URL: "https://chooselife.club",
      NEXT_PUBLIC_APPLE_APP_ID: "6745024708",
      NEXT_PUBLIC_APP_SCHEME: "com.bodok.chooselife",
      PORT: String(port),
    },
    stdio: "ignore",
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      // The server is still starting.
    }
    await wait(250);
  }

  throw new Error("The production server did not start within 30 seconds.");
});

after(() => {
  server?.kill();
});

test("homepage contains crawlable content and SoftwareApplication JSON-LD", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /^text\/html/);
  assert.match(html, /<h1\b/i);
  assert.match(
    html,
    /(?:Find your next highline|Encontre seu pr[oó]ximo highline)/,
  );
  assert.ok(
    visibleText(html).length >= 500,
    `expected at least 500 visible characters, got ${visibleText(html).length}`,
  );

  const jsonLdMatch = html.match(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
  );
  assert.ok(jsonLdMatch, "homepage should contain JSON-LD");
  const jsonLd = JSON.parse(jsonLdMatch[1]);
  const application = jsonLd["@graph"].find(
    (item) => item["@type"] === "SoftwareApplication",
  );

  assert.equal(application.name, "Chooselife");
  assert.equal(application.url, "https://chooselife.club");
  assert.equal(application.applicationCategory, "SportsApplication");

  const localizedMarkdownResponse = await fetch(`${baseUrl}/en`, {
    headers: { Accept: "text/markdown" },
  });
  const localizedMarkdown = await localizedMarkdownResponse.text();
  assert.equal(localizedMarkdownResponse.status, 200);
  assert.match(
    localizedMarkdown,
    /^# Chooselife: the highline community and map/,
  );
  assert.match(localizedMarkdown, /https:\/\/chooselife\.club\/en\/events/);
});

test("homepage negotiates Markdown and varies caches by Accept", async () => {
  const markdownResponse = await fetch(`${baseUrl}/`, {
    headers: { Accept: "text/markdown" },
  });
  const markdown = await markdownResponse.text();

  assert.equal(markdownResponse.status, 200);
  assert.match(
    markdownResponse.headers.get("content-type") || "",
    /^text\/markdown; charset=utf-8$/,
  );
  assert.equal(hasVaryHeader(markdownResponse, "Accept"), true);
  assert.equal(hasVaryHeader(markdownResponse, "Accept-Encoding"), true);
  assert.match(markdown, /^# Chooselife:/);

  const htmlResponse = await fetch(`${baseUrl}/`, {
    headers: { Accept: "text/html, text/markdown;q=0.5" },
  });
  assert.match(htmlResponse.headers.get("content-type") || "", /^text\/html/);

  const markdownPreferredResponse = await fetch(`${baseUrl}/`, {
    headers: { Accept: "text/html;q=0.5, text/markdown" },
  });
  assert.match(
    markdownPreferredResponse.headers.get("content-type") || "",
    /^text\/markdown/,
  );

  const unsupportedResponse = await fetch(`${baseUrl}/`, {
    headers: { Accept: "application/json" },
  });
  assert.equal(unsupportedResponse.status, 406);
});

test("unknown paths return a Markdown 404 with agent navigation", async () => {
  const response = await fetch(`${baseUrl}/some-path-that-does-not-exist`);
  const body = await response.text();

  assert.equal(response.status, 404);
  assert.match(
    response.headers.get("content-type") || "",
    /^text\/markdown; charset=utf-8$/,
  );
  assert.match(body, /https:\/\/chooselife\.club\/sitemap\.xml/);
  assert.match(body, /https:\/\/chooselife\.club\/llms\.txt/);

  const localizedResponse = await fetch(`${baseUrl}/en/missing-resource`);
  assert.equal(localizedResponse.status, 404);

  const headResponse = await fetch(`${baseUrl}/another-missing-page`, {
    method: "HEAD",
  });
  assert.equal(headResponse.status, 404);
});

test("machine-readable discovery files are public and canonical", async () => {
  const llmsResponse = await fetch(`${baseUrl}/llms.txt`);
  const llms = await llmsResponse.text();
  assert.equal(llmsResponse.status, 200);
  assert.match(llms, /^# Chooselife\n/m);
  assert.match(llms, /^> Chooselife/m);
  assert.match(llms, /^## Core pages\n/m);
  assert.match(llms, /\[Homepage\]\(https:\/\/chooselife\.club\/\)/);

  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  const sitemap = await sitemapResponse.text();
  assert.equal(sitemapResponse.status, 200);
  assert.match(sitemap, /<urlset/);
  assert.match(sitemap, /<loc>https:\/\/chooselife\.club<\/loc>/);
  assert.doesNotMatch(sitemap, /https:\/\/chooselife\.club\/pt/);

  const robotsResponse = await fetch(`${baseUrl}/robots.txt`);
  const robots = await robotsResponse.text();
  assert.equal(robotsResponse.status, 200);
  assert.match(robots, /Sitemap: https:\/\/chooselife\.club\/sitemap\.xml/);

  const manifestResponse = await fetch(`${baseUrl}/manifest.webmanifest`);
  const manifest = await manifestResponse.json();
  assert.equal(manifestResponse.status, 200);
  assert.equal(manifest.name, "Chooselife");
  assert.match(manifest.description, /highline app/i);

  for (const path of [
    "/.well-known/apple-app-site-association",
    "/.well-known/assetlinks.json",
  ]) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, `${path} should be public`);
    await response.json();
  }
});
