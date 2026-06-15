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
  eventTitle: string;
}

export interface CheckoutEnv {
  appUrl: string;
  stripeSecretKey: string;
}

export interface WebhookEnv {
  stripeSecretKey: string;
  stripeWebhookSecret: string;
}

export interface GoogleSheetsEnv {
  googleSheetId: string;
  googleClientEmail: string;
  googlePrivateKey: string;
}

export interface EmailEnv {
  resendApiKey: string;
  notificationEmail: string;
  emailFrom: string;
  eventTitle: string;
}

export function getCheckoutEnv(): CheckoutEnv {
  return {
    appUrl: readEnv("APP_URL"),
    stripeSecretKey: readEnv("STRIPE_SECRET_KEY"),
  };
}

export function getWebhookEnv(): WebhookEnv {
  return {
    stripeSecretKey: readEnv("STRIPE_SECRET_KEY"),
    stripeWebhookSecret: readEnv("STRIPE_WEBHOOK_SECRET"),
  };
}

export function getGoogleSheetsEnv(): GoogleSheetsEnv | null {
  const googleSheetId = readOptionalEnv("GOOGLE_SHEET_ID");
  const googleClientEmail = readOptionalEnv("GOOGLE_CLIENT_EMAIL");
  const googlePrivateKey = readOptionalEnv("GOOGLE_PRIVATE_KEY");
  const values = [googleSheetId, googleClientEmail, googlePrivateKey];

  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) {
    throw new Error(
      "Google Sheets registration storage requires GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY",
    );
  }

  return {
    googleSheetId: googleSheetId as string,
    googleClientEmail: googleClientEmail as string,
    googlePrivateKey: (googlePrivateKey as string).replace(/\\n/g, "\n"),
  };
}

export function getEmailEnv(): EmailEnv | null {
  const resendApiKey = readOptionalEnv("RESEND_API_KEY");
  const notificationEmail = readOptionalEnv("NOTIFICATION_EMAIL");
  const emailFrom = readOptionalEnv("EMAIL_FROM");
  const values = [resendApiKey, notificationEmail, emailFrom];

  if (values.every((value) => !value)) return null;
  if (values.some((value) => !value)) {
    throw new Error("Email notifications require RESEND_API_KEY, NOTIFICATION_EMAIL, and EMAIL_FROM");
  }

  return {
    resendApiKey: resendApiKey as string,
    notificationEmail: notificationEmail as string,
    emailFrom: emailFrom as string,
    eventTitle: readEnvWithFallback("EVENT_TITLE", "VITE_PUBLIC_EVENT_TITLE", "Event Registration"),
  };
}

export function getServerEnv(): ServerEnv {
  const checkoutEnv = getCheckoutEnv();
  const webhookEnv = getWebhookEnv();
  const googleSheetsEnv = getGoogleSheetsEnv();
  const emailEnv = getEmailEnv();

  if (!googleSheetsEnv) throw new Error("Missing Google Sheets registration storage configuration");
  if (!emailEnv) throw new Error("Missing email notification configuration");

  return { ...checkoutEnv, ...webhookEnv, ...googleSheetsEnv, ...emailEnv };
}

function readEnv(name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function readOptionalEnv(name: string): string | undefined {
  return env[name] || undefined;
}

function readEnvWithFallback(name: string, fallbackName: string, defaultValue: string): string {
  return env[name] || env[fallbackName] || defaultValue;
}
