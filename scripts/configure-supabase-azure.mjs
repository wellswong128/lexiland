#!/usr/bin/env node

/**
 * Configure Supabase Azure OAuth for personal Microsoft accounts (Outlook/Hotmail).
 *
 * Put secrets in .env.local (see .env.example), then run:
 *   npm run configure:supabase-azure
 */

import { loadEnv, projectRefFromSupabaseUrl } from "./load-env.mjs";

loadEnv();

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  projectRefFromSupabaseUrl(process.env.VITE_SUPABASE_URL);
const clientId = process.env.AZURE_CLIENT_ID?.trim();
const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
const tenantUrl =
  process.env.AZURE_TENANT_URL?.trim() ||
  "https://login.microsoftonline.com/consumers";

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
  [
    "Add it to .env.local in the project root.",
    "Create one at https://supabase.com/dashboard/account/tokens",
  ].join("\n"),
);

requireEnv(
  "SUPABASE_PROJECT_REF",
  projectRef,
  [
    "Add SUPABASE_PROJECT_REF=your_project_ref to .env.local,",
    "or set VITE_SUPABASE_URL=https://your-project-ref.supabase.co",
  ].join("\n"),
);

requireEnv(
  "AZURE_CLIENT_ID",
  clientId,
  "Add AZURE_CLIENT_ID from Azure Portal → App registrations → Application (client) ID.",
);

requireEnv(
  "AZURE_CLIENT_SECRET",
  clientSecret,
  "Add AZURE_CLIENT_SECRET from Azure Portal → Certificates & secrets → Value.",
);

async function patchAuthConfig() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_azure_enabled: true,
      external_azure_client_id: clientId,
      external_azure_secret: clientSecret,
      external_azure_url: tenantUrl,
    }),
  });

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    console.error("Failed to update Supabase Azure config:", payload || text);
    process.exit(1);
  }

  console.log("Supabase Azure OAuth configured successfully.");
  console.log(`  Tenant URL: ${tenantUrl}`);
  console.log(`  Client ID: ${clientId}`);
  console.log("");
  console.log("Also confirm in Azure Portal → App registrations:");
  console.log(`  1. Web redirect URI: https://${projectRef}.supabase.co/auth/v1/callback`);
  console.log("  2. API permissions (Microsoft Graph delegated): openid, email, profile, User.Read");
  console.log("  3. Manifest → optionalClaims.idToken: add email (and xms_edov recommended)");
}

patchAuthConfig().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
