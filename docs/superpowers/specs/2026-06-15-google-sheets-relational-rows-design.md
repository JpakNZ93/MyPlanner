# Google Sheets Relational Rows Design

## Summary

Update Google Sheets registration storage so every write explicitly inserts new rows and additional attendees are stored in their own related sheet. This keeps primary registration/payment data in one-row-per-registration tables while giving additional attendees one row each, linked back to the primary registration by `registrationId`.

## Goals

- Ensure pending and paid Google Sheets writes create new rows with `INSERT_ROWS`.
- Add an `AdditionalAttendees` sheet for child attendee rows.
- Write additional attendee rows during the pending pre-payment checkout step.
- Keep the current frontend payload and Stripe Checkout behavior unchanged.
- Preserve webhook idempotency by continuing to deduplicate paid rows by Stripe checkout session ID.

## Data Model

Google Sheets will contain three tabs:

1. `PendingRegistrations`
   - One row per checkout attempt.
   - Headers: `registrationId`, `createdAt`, `payload`.
   - The payload remains the normalized registration JSON used by the webhook to build the paid registration record.

2. `PaidRegistrations`
   - One row per successful paid registration.
   - Headers: `registrationId`, `stripeSessionId`, `paymentStatus`, `seatCount`, `pricePerSeatCents`, `totalAmountCents`, `currency`, `primaryFirstName`, `primaryLastName`, `primaryMobile`, `primaryEmail`, `primaryChurch`, `createdAt`, `paidAt`.
   - Additional attendees are no longer stored as JSON in this paid row; the related child table is the reporting source for attendee rows.

3. `AdditionalAttendees`
   - One row per additional attendee.
   - Headers: `registrationId`, `attendeeIndex`, `firstName`, `lastName`, `church`, `mobile`, `email`, `usesPrimaryContact`, `createdAt`.
   - `registrationId` references the parent registration in `PendingRegistrations` before payment and in `PaidRegistrations` after payment.
   - `attendeeIndex` is stable within the submitted additional attendee list and starts at `1`.

The relationship is:

```text
PendingRegistrations.registrationId
PaidRegistrations.registrationId
  -> AdditionalAttendees.registrationId
```

## Components

`api/lib/google-sheets.ts` remains the Google Sheets storage boundary. It should own the tab ranges and append options for all three sheets.

`api/lib/registration-records.ts` should own row mapping helpers for:

- pending registration rows
- paid registration rows
- additional attendee rows

`api/create-checkout-session.ts` should:

1. Normalize the submitted registration payload.
2. Generate the `registrationId` and `createdAt` values.
3. Append the pending registration row.
4. Append zero or more additional attendee rows using the same `registrationId`.
5. Create the Stripe Checkout session with `registrationId` in metadata.

`api/stripe-webhook.ts` should keep the current paid registration flow:

1. Validate the Stripe webhook signature.
2. Ignore non-paid or non-checkout-completed events.
3. Skip duplicate paid sessions by `stripeSessionId`.
4. Find the pending registration by `registrationId`.
5. Append the paid registration row.
6. Send notification email after the paid row is saved.

The webhook does not need to rewrite additional attendee rows because they were already captured before payment and share the same `registrationId`.

## Row Insertion Behavior

All Google Sheets append calls should include:

```ts
insertDataOption: "INSERT_ROWS"
```

This applies to:

- `PendingRegistrations`
- `PaidRegistrations`
- `AdditionalAttendees`

The existing `valueInputOption: "RAW"` behavior should remain.

## Error Handling

- If all Google Sheets environment variables are omitted, checkout can still proceed without writing pending or attendee rows.
- If Google Sheets is configured and the pending row append fails, checkout should fail before creating a Stripe session.
- If any additional attendee row append fails, checkout should fail before creating a Stripe session so the Sheets data is not partial.
- If paid row append fails in the Stripe webhook, the webhook should keep returning a retryable `500`.
- Email delivery should remain nonblocking after the paid row is saved.

## Documentation Updates

Update the README Google Sheets setup section to include the `AdditionalAttendees` tab and revised `PaidRegistrations` headers. The sandbox verification steps should mention checking both the paid primary row and related additional attendee rows when the registration includes guests.

## Testing

Add or update tests to cover:

- Pending row mapping remains unchanged.
- Paid row mapping no longer includes additional attendee JSON.
- Additional attendee row mapping includes `registrationId`, a stable index, attendee fields, `usesPrimaryContact`, and `createdAt`.
- Checkout API writes pending rows and related additional attendee rows before creating the Stripe Checkout session.
- Checkout API does not write additional attendee rows when Sheets storage is not configured.
- Webhook still reads pending registrations, skips duplicate Stripe sessions, appends a paid row, and sends email after successful storage.

Run the repository checks after implementation:

```text
npm test
npm run lint
npm run build
```

## Out of Scope

- Migrating existing Google Sheets data.
- Creating separate paid-only additional attendee rows.
- Changing the frontend registration form.
- Changing Stripe Checkout pricing or payment flow.
- Changing email notification content.
