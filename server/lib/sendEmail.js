import nodemailer from "nodemailer";

let cachedTransporter = null;

function getSmtpConfig() {
  const cloudflareToken = String(process.env.CLOUDFLARE_API_TOKEN || "").trim();
  const senderEmail = String(process.env.SMTP_SENDER_EMAIL || "no-reply@lexiland.cc").trim();
  const senderName = String(process.env.SMTP_SENDER_NAME || "力思樂園").trim();

  if (!cloudflareToken) {
    throw new Error("CLOUDFLARE_API_TOKEN is not configured for email sending.");
  }

  return {
    cloudflareToken,
    senderEmail,
    senderName,
  };
}

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const { cloudflareToken } = getSmtpConfig();

  cachedTransporter = nodemailer.createTransport({
    host: "smtp.mx.cloudflare.net",
    port: 465,
    secure: true,
    auth: {
      user: "api_token",
      pass: cloudflareToken,
    },
  });

  return cachedTransporter;
}

export function isEmailConfigured() {
  return Boolean(String(process.env.CLOUDFLARE_API_TOKEN || "").trim());
}

export async function sendEmail({ to, subject, html, text }) {
  const { senderEmail, senderName } = getSmtpConfig();
  const transporter = getTransporter();

  await transporter.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject,
    html,
    text,
  });
}
