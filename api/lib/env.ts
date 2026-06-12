import { env } from "node:process";

export interface ServerEnv {
  appUrl: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  googleSheetId: string;
  googleClientEmail: string;
  googlePrivateKey: string;
  resendApiKey: string;
  notificationEmail: string;
  emailFrom: string;
}

export function getServerEnv(): ServerEnv {
  return {
    appUrl: readEnv("APP_URL"),
    stripeSecretKey: readEnv("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: readEnv("STRIPE_WEBHOOK_SECRET"),
    googleSheetId: readEnv("GOOGLE_SHEET_ID"),
    googleClientEmail: readEnv("GOOGLE_CLIENT_EMAIL"),
    googlePrivateKey: readEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    resendApiKey: readEnv("RESEND_API_KEY"),
    notificationEmail: readEnv("NOTIFICATION_EMAIL"),
    emailFrom: readEnv("EMAIL_FROM"),
  };
}

function readEnv(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}
