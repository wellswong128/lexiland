#!/usr/bin/env node

/**
 * Switch Supabase magic-link email template to 6-digit OTP codes.
 *
 * Requires in .env.local:
 *   SUPABASE_ACCESS_TOKEN
 *   SUPABASE_PROJECT_REF or VITE_SUPABASE_URL
 *
 * Run:
 *   npm run configure:supabase-otp-email
 */

import { loadEnv, projectRefFromSupabaseUrl } from "./load-env.mjs";

loadEnv();

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectRef =
  process.env.SUPABASE_PROJECT_REF?.trim() ||
  projectRefFromSupabaseUrl(process.env.VITE_SUPABASE_URL);

const otpEmailSubject = "力思樂園登入驗證碼 / LexiLand sign-in code";
const otpEmailContent = [
  "<h2>力思樂園 LexiLand</h2>",
  "<p>你的登入驗證碼是：</p>",
  '<p style="font-size: 28px; font-weight: bold; letter-spacing: 0.3em;">{{ .Token }}</p>',
  "<p>Your sign-in code is: <strong>{{ .Token }}</strong></p>",
  "<p>此驗證碼 1 小時內有效。This code expires in 1 hour.</p>",
].join("");

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
  "Create one at https://supabase.com/dashboard/account/tokens and add to .env.local",
);

requireEnv(
  "SUPABASE_PROJECT_REF",
  projectRef,
  "Add SUPABASE_PROJECT_REF=your_project_ref to .env.local, or set VITE_SUPABASE_URL",
);

async function patchOtpEmailTemplate() {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/config/auth`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mailer_subjects_magic_link: otpEmailSubject,
      mailer_templates_magic_link_content: otpEmailContent,
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
    console.error("Failed to update Supabase OTP email template:", payload || text);
    process.exit(1);
  }

  console.log("Supabase OTP email template configured successfully.");
  console.log(`  Project: ${projectRef}`);
  console.log(`  Subject: ${otpEmailSubject}`);
}

patchOtpEmailTemplate().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
