#!/usr/bin/env node

/**
 * Sync VITE_GOOGLE_CLIENT_ID from Supabase Auth config and print GCP branding steps.
 *
 * Usage:
 *   npm run sync:google-oauth-env
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnv, projectRefFromSupabaseUrl } from "./load-env.mjs";

loadEnv();

const repoRoot = join(import.meta.dirname, "..");
const envLocalPath = join(repoRoot, ".env.local");
const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  projectRefFromSupabaseUrl(process.env.VITE_SUPABASE_URL);
const appName = process.env.GOOGLE_OAUTH_APP_NAME?.trim() || "LexiLand";
const appDomain = (process.env.VITE_APP_URL || "https://learn.lexiland.cc").replace(/\/$/, "");
const siteDomain = new URL(appDomain).hostname;
const rootDomain = siteDomain.replace(/^learn\./, "");

function requireEnv(name, value, hint) {
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    if (hint) {
      console.error(hint);
    }
    process.exit(1);
  }
}

requireEnv(
  "SUPABASE_ACCESS_TOKEN",
  accessToken,
  "Add SUPABASE_ACCESS_TOKEN to .env.local (https://supabase.com/dashboard/account/tokens).",
);

requireEnv(
  "SUPABASE_PROJECT_REF",
  projectRef,
  "Add SUPABASE_PROJECT_REF or VITE_SUPABASE_URL to .env.local.",
);

async function fetchAuthConfig() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    console.error("Failed to read Supabase Auth config:", payload || text);
    process.exit(1);
  }

  return payload;
}

function upsertEnvLocal(key, value) {
  const line = `${key}=${value}`;

  if (!existsSync(envLocalPath)) {
    appendFileSync(envLocalPath, `${line}\n`, "utf8");
    return "added";
  }

  const content = readFileSync(envLocalPath, "utf8");
  const pattern = new RegExp(`^${key}=.*$`, "m");

  if (pattern.test(content)) {
    return "already-set";
  }

  appendFileSync(envLocalPath, `\n${line}\n`, "utf8");
  return "added";
}

const authConfig = await fetchAuthConfig();
const clientId = authConfig.external_google_client_id?.trim() || "";

if (!clientId) {
  console.error("Google provider is not configured in Supabase Auth.");
  process.exit(1);
}

const envStatus = upsertEnvLocal("VITE_GOOGLE_CLIENT_ID", clientId);

console.log("Google OAuth env sync");
console.log(`  project: ${projectRef}`);
console.log(`  client id: ${clientId.slice(0, 16)}...`);
console.log(`  .env.local: VITE_GOOGLE_CLIENT_ID ${envStatus}`);
console.log("");
console.log("To show LexiLand instead of *.supabase.co on the Google account picker:");
console.log("  1. Open https://console.cloud.google.com/apis/credentials/consent");
console.log(`  2. Set App name to "${appName}" and upload your logo`);
console.log(`  3. Set App home page to ${appDomain}`);
console.log(`  4. Add Authorized domains: ${rootDomain}`);
console.log(`  5. Verify ${rootDomain} in Google Search Console`);
console.log("  6. Under Credentials → your OAuth Web client:");
console.log(`     - Authorized JavaScript origins: ${appDomain}, http://localhost:5173`);
console.log(`     - Authorized redirect URIs: https://${projectRef}.supabase.co/auth/v1/callback`);
console.log("  7. Publish the OAuth consent screen (or keep Testing with test users)");
console.log("");
console.log("Then add the same client ID to Vercel:");
console.log(`  VITE_GOOGLE_CLIENT_ID=${clientId}`);
console.log("");
console.log(
  "The app now uses Google Identity Services on web, so users should see your app name instead of the Supabase project URL.",
);
