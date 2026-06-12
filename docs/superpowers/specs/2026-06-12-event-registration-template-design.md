# Event Registration Template Design

## Summary

Build a reusable event registration webpage template for paid seat bookings. The public page is a static, branded registration form deployed on Vercel, with secure serverless API routes for Stripe Checkout, Stripe payment confirmation, Google Sheets recording, and email notification.

The initial deployment uses Stripe sandbox/test mode, AUD pricing, and configurable event details so the same template can be reused for different events.

## Goals

- Provide a simple attendee registration flow for events.
- Support a configurable background image, event title, subtitle, date, and venue.
- Collect required primary attendee details before payment.
- Allow users to add and remove additional attendees.
- Let additional attendees reuse the primary attendee contact details.
- Charge a fixed price per seat in AUD.
- Use Stripe Checkout for the easiest and safest card payment flow.
- Record paid registrations in Google Sheets.
- Send an email notification for each paid registration.
- Deploy on Vercel's free tier as a static frontend plus serverless functions.

## Non-Goals

- Building an admin dashboard.
- Supporting refunds, transfers, discount codes, or waitlists in the first version.
- Storing card details directly on the site.
- Replacing Stripe's hosted payment page with embedded card fields.
- Supporting production payments before sandbox payment flow is verified.

## Recommended Architecture

The template has four main parts:

1. **Static frontend**
   - Hosted by Vercel.
   - Renders the event registration page.
   - Reads public configuration for event title, subtitle, venue, date, background image, price display, and currency display.
   - Validates basic form input before checkout.

2. **Checkout API route**
   - Runs as a Vercel serverless function.
   - Validates the submitted registration payload.
   - Calculates the total amount as `seatCount * AUD 50`.
   - Creates a pending registration row in a Google Sheets `PendingRegistrations` tab.
   - Creates a Stripe Checkout session in sandbox/test mode.
   - Stores only the pending registration ID in Stripe Checkout metadata.
   - Returns the Stripe Checkout URL to the frontend.

3. **Stripe webhook API route**
   - Runs as a Vercel serverless function.
   - Verifies Stripe's webhook signature.
   - Handles successful checkout completion events.
   - Reads the pending registration by ID from Google Sheets.
   - Records the paid registration in Google Sheets.
   - Sends the notification email after the sheet write succeeds.
   - Uses the Stripe checkout session ID to avoid duplicate sheet rows when Stripe retries webhook delivery.

4. **Success and cancel pages**
   - Success page confirms that payment was completed and registration is being processed.
   - Cancel page lets the user return to registration and retry payment.

## Registration Form Design

The page displays:

- configurable background image
- configurable event title
- configurable subtitle, date, and venue
- price shown as `AUD $50 per seat`
- a clear call to action to register and pay

### Primary Attendee

The primary attendee is required and must provide:

- first name
- last name
- mobile number
- email address
- church

### Additional Attendees

The user can click **Add another attendee** for a husband, wife, friend, or other guest.

Each additional attendee supports:

- first name
- last name
- church
- optional contact details
- checkbox to use the primary attendee's mobile number and email address
- remove button

Additional attendee details are optional when the user is buying unnamed seats, but any partially completed attendee row should be validated so the saved data is consistent.

### Seats

The form includes a seat count.

Rules:

- Seat count must be at least `1`.
- Seat count must be at least the number of attendee rows.
- Users may buy extra unnamed seats by setting seat count higher than the number of attendee rows.
- Total price is `seatCount * AUD 50`.

## Payment Flow

1. User completes the registration form.
2. Frontend validates required fields and seat count.
3. User clicks **Pay with Stripe**.
4. Checkout API route creates a Stripe Checkout session.
5. User is redirected to Stripe Checkout.
6. User enters card details on Stripe's hosted page.
7. Stripe redirects the user to success or cancel page.
8. Stripe sends a webhook to the app after successful payment.
9. Webhook reads the pending registration from Google Sheets.
10. Webhook records the paid registration in the paid registrations sheet tab.
11. Webhook sends the configured notification email.

This flow keeps card handling inside Stripe and keeps the site compatible with a low-maintenance Vercel deployment.

## Data Model

Google Sheets will contain two tabs:

- `PendingRegistrations`: temporary rows created before Stripe Checkout.
- `PaidRegistrations`: official paid registrations created only after Stripe confirms payment.

Each paid registration row should contain:

- registration ID
- Stripe checkout session ID
- payment status
- seat count
- price per seat
- total amount
- currency
- primary attendee first name
- primary attendee last name
- primary attendee mobile number
- primary attendee email address
- primary attendee church
- additional attendees as structured JSON
- created timestamp
- paid timestamp

The first version stores one row per paid registration. Additional attendees are stored as structured JSON in one cell so the sheet remains compact and the webhook can preserve variable-length attendee lists. If later reporting needs one row per attendee, the webhook can be adjusted to write each attendee to a separate sheet tab while keeping the same payment confirmation flow.

## Validation

Frontend validation provides fast feedback. Server-side validation is authoritative.

Required server-side rules:

- Primary first name is required.
- Primary last name is required.
- Primary mobile number is required.
- Primary email address is required and must look like an email address.
- Primary church is required.
- Seat count must be an integer greater than or equal to `1`.
- Seat count must be greater than or equal to the number of attendee rows.
- Additional attendee rows that contain any entered field must be normalized and validated consistently.

## Configuration

Deployment-specific values should be configured through environment variables. Frontend-safe values use a public prefix such as `VITE_PUBLIC_`; secrets stay server-side only.

Public configuration:

- event title
- event subtitle
- event date
- event venue
- background image URL
- displayed price and currency

Secret configuration:

- Stripe secret key
- Stripe webhook signing secret
- server-side price amount in cents, set to `5000` for AUD $50
- Google service account credentials
- Google Sheet ID
- notification email recipient
- Resend API key
- email sender address

The server-side price must be the source of truth so users cannot change the amount in the browser.

## Google Sheets Integration

Setup should include:

1. Create a Google Sheet for registrations.
2. Add `PendingRegistrations` and `PaidRegistrations` tabs.
3. Add header columns that match the data model.
4. Create a Google service account.
5. Share the sheet with the service account email.
6. Store the sheet ID and service account credentials in Vercel environment variables.

The checkout API writes temporary pending rows before redirecting to Stripe. The webhook writes official paid rows only after Stripe confirms payment.

## Email Integration

Use Resend for email delivery. It has a simple API, works well from Vercel serverless functions, and can be configured through environment variables.

The email notification is sent after the paid registration is written to Google Sheets.

The email should include:

- event title
- registration ID
- Stripe checkout session ID
- payment amount
- seat count
- primary attendee details
- additional attendee summary

The recipient email is configured at deployment time.

## Reliability and Error Handling

- Checkout creation failures show a clear error on the form and keep user-entered data available.
- If the pending Google Sheets write fails, checkout is not started because the webhook would not be able to recover attendee details.
- Stripe webhook signatures are verified before processing.
- Webhook processing ignores unpaid or incomplete sessions.
- Duplicate Stripe webhook retries do not create duplicate sheet rows.
- If the paid Google Sheets write fails, the webhook should return a retryable error so Stripe retries delivery.
- If email sending fails after the sheet write succeeds, the failure should be logged without duplicating the registration row.
- Success page messaging should not claim sheet/email completion unless that status can be confirmed.

## Testing Strategy

Automated tests should cover:

- required primary attendee fields
- email format validation
- seat count rules
- add attendee behavior
- remove attendee behavior
- reuse primary contact checkbox behavior
- checkout session amount and currency calculation
- server-side rejection of invalid checkout payloads
- webhook handling for successful paid sessions
- duplicate webhook idempotency
- mocked Google Sheets writes
- mocked email notifications

Manual sandbox verification should cover:

- Stripe test card payment succeeds.
- Stripe cancel path returns to the site.
- Paid registration appears in Google Sheets.
- Notification email is delivered to the configured recipient.

## Setup Documentation Scope

Implementation documentation should explain how to:

- run the project locally
- configure event title, subtitle, date, venue, and background image
- create Stripe sandbox keys
- configure Stripe Checkout and webhook endpoint
- create the Google Sheet
- configure Google service account access
- configure email delivery
- set Vercel environment variables
- deploy to Vercel
- complete an end-to-end sandbox payment test

## Implementation Decisions

- Use Vite, React, and TypeScript for the frontend.
- Use Vercel serverless functions in an `api` directory for checkout and webhook routes.
- Use Stripe Checkout in sandbox/test mode for card payment.
- Use Google Sheets as both the temporary pending registration store and the official paid registration record.
- Use a pending registration ID in Stripe metadata instead of storing the full attendee payload in Stripe metadata.
- Use Resend for email notifications.
- Store additional attendees as structured JSON in a single sheet cell for the first version.
