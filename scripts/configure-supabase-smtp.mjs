#!/usr/bin/env node

/**
 * Configure Supabase Auth SMTP (Cloudflare Email Service) + site URLs.
 *
 * Put secrets in .env.local (see .env.example), then run:
 *   npm run configure:supabase-smtp
 */

import { loadEnv, projectRefFromSupabaseUrl } from "./load-env.mjs";

loadEnv();

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  projectRefFromSupabaseUrl(process.env.VITE_SUPABASE_URL);
const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const senderEmail = process.env.SMTP_SENDER_EMAIL?.trim() || "no-reply@lexiland.cc";
const senderName = process.env.SMTP_SENDER_NAME?.trim() || "力思樂園";
const siteUrl = (process.env.SITE_URL || process.env.VITE_APP_URL || "https://learn.lexiland.cc")
  .trim()
  .replace(/\/$/, "");

const smtpHost = "smtp.mx.cloudflare.net";
const smtpPort = 465;
const smtpUser = "api_token";

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
  "CLOUDFLARE_API_TOKEN",
  cloudflareToken,
  "Add CLOUDFLARE_API_TOKEN with Email Sending: Edit permission to .env.local.",
);

const redirectUrls = [
  siteUrl,
  `${siteUrl}/**`,
  `${siteUrl}/auth/callback`,
  "http://localhost:5173",
  "http://localhost:5173/**",
  "http://localhost:5173/auth/callback",
];

async function patchAuthConfig() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      external_email_enabled: true,
      site_url: siteUrl,
      uri_allow_list: redirectUrls.join(","),
      smtp_admin_email: senderEmail,
      smtp_host: smtpHost,
      smtp_port: smtpPort,
      smtp_user: smtpUser,
      smtp_pass: cloudflareToken,
      smtp_sender_name: senderName,
      smtp_max_frequency: 30,
      mailer_autoconfirm: false,
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
    console.error("Failed to update Supabase Auth config:", payload || text);
    process.exit(1);
  }

  console.log("Supabase Auth SMTP configured successfully.");
  console.log(`  Site URL: ${siteUrl}`);
  console.log(`  SMTP host: ${smtpHost}:${smtpPort}`);
  console.log(`  SMTP user: ${smtpUser}`);
  console.log(`  Sender: ${senderName} <${senderEmail}>`);
  console.log(`  Redirect URLs: ${redirectUrls.join(", ")}`);
  console.log("");
  console.log(
    "Important: the sender domain must be onboarded in Cloudflare Email Service → Email Sending.",
  );
  console.log(
    "If you see 'Email sending not authorized', onboard that exact domain or change SMTP_SENDER_EMAIL.",
  );
}

patchAuthConfig().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
