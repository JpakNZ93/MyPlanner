import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as crypto from "node:crypto";
import Stripe from "stripe";

import {
  CURRENCY,
  DISPLAY_CURRENCY,
  normalizeRegistration,
  PRICE_PER_SEAT_CENTS,
} from "../src/lib/registration.js";
import { getServerEnv } from "./lib/env.js";
import { createRegistrationSheetClient } from "./lib/google-sheets.js";
import { sendJson, sendMethodNotAllowed } from "./lib/http.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== "POST") {
    sendMethodNotAllowed(response);
    return;
  }

  let payload;
  try {
    payload = normalizeRegistration(request.body);
  } catch {
    sendJson(response, 400, { error: "Invalid registration details" });
    return;
  }

  const env = getServerEnv();
  const registrationId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const sheetClient = createRegistrationSheetClient(env);

  await sheetClient.appendPendingRegistration({ registrationId, createdAt, payload });

  const stripe = new Stripe(env.stripeSecretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${env.appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/cancel`,
    customer_email: payload.primaryAttendee.email,
    metadata: { registrationId },
    line_items: [
      {
        quantity: payload.seatCount,
        price_data: {
          currency: CURRENCY,
          unit_amount: PRICE_PER_SEAT_CENTS,
          product_data: {
            name: "Event seat",
            description: `${DISPLAY_CURRENCY} $50 per seat`,
          },
        },
      },
    ],
  });

  if (!session.url) {
    sendJson(response, 502, { error: "Stripe did not return a checkout URL" });
    return;
  }

  sendJson(response, 200, { checkoutUrl: session.url });
}
