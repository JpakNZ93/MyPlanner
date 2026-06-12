import { Resend } from "resend";

import type { PaidRegistrationRecord } from "../../src/lib/registration";
import type { ServerEnv } from "./env";

export async function sendRegistrationEmail(env: ServerEnv, record: PaidRegistrationRecord) {
  const resend = new Resend(env.resendApiKey);
  const primaryName = `${record.primaryAttendee.firstName} ${record.primaryAttendee.lastName}`;
  const attendeeSummary = record.additionalAttendees.length
    ? record.additionalAttendees
        .map((attendee) => `${attendee.firstName} ${attendee.lastName} (${attendee.church})`)
        .join(", ")
    : "No additional attendee names provided";

  await resend.emails.send({
    from: env.emailFrom,
    to: env.notificationEmail,
    subject: `Paid registration: ${primaryName}`,
    text: [
      `Registration ID: ${record.registrationId}`,
      `Stripe session: ${record.stripeSessionId}`,
      `Payment amount: ${record.currency.toUpperCase()} ${(record.totalAmountCents / 100).toFixed(2)}`,
      `Seat count: ${record.seatCount}`,
      `Primary attendee: ${primaryName}`,
      `Mobile: ${record.primaryAttendee.mobile}`,
      `Email: ${record.primaryAttendee.email}`,
      `Church: ${record.primaryAttendee.church}`,
      `Additional attendees: ${attendeeSummary}`,
    ].join("\n"),
  });
}
