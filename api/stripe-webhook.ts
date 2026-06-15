import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

import {
  calculateTotalAmount,
  CURRENCY,
  PRICE_PER_SEAT_CENTS,
  type PaidRegistrationRecord,
} from "../src/lib/registration.js";
import { getEmailEnv, getGoogleSheetsEnv, getWebhookEnv } from "./lib/env.js";
import { sendRegistrationEmail } from "./lib/email.js";
import { createRegistrationSheetClient } from "./lib/google-sheets.js";
import { sendJson, sendMethodNotAllowed } from "./lib/http.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    sendMethodNotAllowed(response);
    return;
  }

  const env = getWebhookEnv();
  const stripe = new Stripe(env.stripeSecretKey);
  const signature = request.headers["stripe-signature"];

  if (!signature || Array.isArray(signature)) {
    sendJson(response, 400, { error: "Missing Stripe signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await readRawBody(request),
      signature,
      env.stripeWebhookSecret,
    );
  } catch {
    sendJson(response, 400, { error: "Invalid Stripe signature" });
    return;
  }

  if (event.type !== "checkout.session.completed") {
    sendJson(response, 200, { received: true });
    return;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    sendJson(response, 200, { received: true });
    return;
  }

  const registrationId = session.metadata?.registrationId;
  if (!registrationId) {
    sendJson(response, 400, { error: "Missing registration ID" });
    return;
  }

  const googleSheetsEnv = getGoogleSheetsEnv();
  if (!googleSheetsEnv) {
    console.warn("Registration storage is not configured");
    sendJson(response, 200, { received: true, storage: "not_configured" });
    return;
  }

  const sheetClient = createRegistrationSheetClient(googleSheetsEnv);
  if (await sheetClient.hasPaidSession(session.id)) {
    sendJson(response, 200, { received: true, duplicate: true });
    return;
  }

  const pendingRegistration = await sheetClient.findPendingRegistration(registrationId);
  if (!pendingRegistration) {
    sendJson(response, 500, { error: "Pending registration not found" });
    return;
  }

  const paidRecord: PaidRegistrationRecord = {
    registrationId,
    stripeSessionId: session.id,
    paymentStatus: "paid",
    seatCount: pendingRegistration.payload.seatCount,
    primaryAttendee: pendingRegistration.payload.primaryAttendee,
    additionalAttendees: pendingRegistration.payload.additionalAttendees,
    pricePerSeatCents: PRICE_PER_SEAT_CENTS,
    totalAmountCents: calculateTotalAmount(pendingRegistration.payload.seatCount),
    currency: CURRENCY,
    createdAt: pendingRegistration.createdAt,
    paidAt: new Date().toISOString(),
  };

  try {
    await sheetClient.appendPaidRegistration(paidRecord);
  } catch {
    sendJson(response, 500, { error: "Paid registration could not be saved" });
    return;
  }

  try {
    const emailEnv = getEmailEnv();
    if (emailEnv) {
      await sendRegistrationEmail(emailEnv, paidRecord);
    }
  } catch (error) {
    console.error("Failed to send registration email", error);
  }

  sendJson(response, 200, { received: true });
}

async function readRawBody(request: VercelRequest): Promise<string | Buffer> {
  if (typeof request.body === "string" || Buffer.isBuffer(request.body)) {
    return request.body;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
