# Event Registration Template

## Overview

Vercel-ready event registration template with a static React frontend, Stripe sandbox Checkout, Google Sheets records, and Resend email notifications.

## Features

- Configurable event title, subtitle, date, venue, and background image.
- Required primary attendee fields for first name, last name, mobile number, email address, and church.
- Additional attendees with remove controls.
- Same contact checkbox for additional attendees.
- AUD $50 seat count and total calculation.
- Stripe hosted Checkout.
- Google Sheets `PendingRegistrations` and `PaidRegistrations` tabs.
- Resend email notification after a paid registration is saved.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`npm run dev` starts the Vite frontend only. It is useful for form UI work, but it does not serve the Vercel `/api/*` functions used for checkout sessions or Stripe webhooks.

For full local checkout/API testing, run the project through Vercel:

```bash
npx vercel dev
```

You can also test the complete API and Stripe webhook flow from a Vercel deployment.

## CI/CD

This repo uses a hybrid Vercel and GitHub Actions deployment flow.

- Vercel remains the deployment engine through its Git integration.
- Pull requests and feature branches create Vercel Preview deployments.
- Merges to `main` automatically create Vercel Production deployments.
- GitHub Actions runs the `CI` workflow on pull requests targeting `main` and pushes to `main`.
- The `CI` workflow installs dependencies with `npm ci`, then runs `npm run lint`, `npm run test`, and `npm run build`.

Recommended GitHub branch protection for `main`:

1. Require a pull request before merging.
2. Require status checks to pass before merging.
3. Require the GitHub Actions `CI` check.
4. Keep Vercel deployment checks visible on pull requests.

Do not add Vercel deployment commands or Vercel tokens to GitHub Actions for this setup. Vercel should continue to own preview and production deployments.

## Google Sheets setup

1. Create a Google Sheet for registrations.
2. Add a `PendingRegistrations` tab with these headers:

   ```text
   registrationId, createdAt, payload
   ```

3. Add a `PaidRegistrations` tab with these headers:

   ```text
   registrationId, stripeSessionId, paymentStatus, seatCount, pricePerSeatCents, totalAmountCents, currency, primaryFirstName, primaryLastName, primaryMobile, primaryEmail, primaryChurch, additionalAttendees, createdAt, paidAt
   ```

4. Create a Google Cloud service account with Google Sheets API access.
5. Share the registration sheet with the service account email.
6. Set `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` in Vercel.

## Stripe sandbox setup

1. Use Stripe test mode.
2. Set `STRIPE_SECRET_KEY`.
3. Create a webhook endpoint:

   ```text
   https://your-vercel-domain.example/api/stripe-webhook
   ```

4. Listen for `checkout.session.completed`.
5. Set `STRIPE_WEBHOOK_SECRET` from the webhook endpoint signing secret.

## Resend setup

1. Create a Resend API key.
2. Configure a verified sender or testing sender.
3. Set `RESEND_API_KEY`, `EMAIL_FROM`, and `NOTIFICATION_EMAIL`.

## Vercel environment variables

Copy the `.env.example` values into the Vercel project settings and replace each example value with the project-specific value. Keep secret keys server-side only; do not expose Stripe, Google, or Resend secrets through `VITE_` variables.

Set `EVENT_TITLE` for the server-side notification email title. The frontend title can use `VITE_PUBLIC_EVENT_TITLE`; when `EVENT_TITLE` is omitted, the server falls back to `VITE_PUBLIC_EVENT_TITLE` and then `Event Registration`.

The included `vercel.json` rewrites `/success` and `/cancel` to the React app so Stripe redirects load the client-rendered confirmation pages. `/api/*` routes are not rewritten and continue to resolve to Vercel functions.

## Reliability and operations

Google Sheets idempotency prevents sequential duplicate Stripe webhook rows by Stripe session ID, but it is not an atomic concurrency lock. For very high-volume deployments, use a datastore with atomic uniqueness for paid session IDs.

## Sandbox verification

1. Deploy to Vercel.
2. Submit the form with one primary attendee and one seat.
3. Pay with the Stripe test card `4242 4242 4242 4242`.
4. Confirm the app redirects to the success page.
5. Confirm a paid row appears in the `PaidRegistrations` tab.
6. Confirm the notification email is delivered.
