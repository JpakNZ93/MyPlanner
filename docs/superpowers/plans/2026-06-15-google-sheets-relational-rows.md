# Google Sheets Relational Rows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store Google Sheets registration data with explicit inserted rows and a related `AdditionalAttendees` child table keyed by `registrationId`.

**Architecture:** Keep Google Sheets behavior behind `api/lib/google-sheets.ts`, keep row serialization in `api/lib/registration-records.ts`, and let the checkout API write pending plus additional-attendee rows before creating Stripe Checkout. The Stripe webhook continues to use the pending row for payment confirmation and appends a paid primary row only after Stripe confirms payment.

**Tech Stack:** TypeScript, Vercel serverless functions, Google Sheets API via `googleapis`, Stripe, Vitest.

---

## File Structure

- Modify `api/lib/registration-records.ts`
  - Add an additional-attendee row record interface and mapper.
  - Remove the additional-attendee JSON cell from paid registration rows.
  - Keep current pending row mapping and legacy pending row reader.
- Modify `api/lib/google-sheets.ts`
  - Add `AdditionalAttendees!A:I`.
  - Add `appendAdditionalAttendees`.
  - Add `insertDataOption: "INSERT_ROWS"` to every append call.
- Modify `api/create-checkout-session.ts`
  - After appending the pending row, append child additional-attendee rows with the same `registrationId` and `createdAt`.
- Modify `api/lib/__tests__/records.test.ts`
  - Assert the paid row no longer contains additional-attendee JSON.
  - Assert the new additional-attendee row mapping.
- Create `api/lib/__tests__/google-sheets.test.ts`
  - Mock `googleapis` and verify append ranges/options for pending, paid, and additional attendees.
- Modify `api/lib/__tests__/checkout.test.ts`
  - Mock and assert `appendAdditionalAttendees`.
- Modify `README.md`
  - Add the `AdditionalAttendees` setup instructions and revise `PaidRegistrations` headers.

---

### Task 1: Registration Row Mappers

**Files:**
- Modify: `api/lib/__tests__/records.test.ts`
- Modify: `api/lib/registration-records.ts`

- [ ] **Step 1: Write failing row-mapping tests**

In `api/lib/__tests__/records.test.ts`, update the import block to include `additionalAttendeeToRow`:

```ts
import { describe, expect, it } from "vitest";
import {
  additionalAttendeeToRow,
  paidRegistrationToRow,
  pendingRegistrationToRow,
  rowToPendingRegistration,
} from "../registration-records.js";
```

Replace the paid-row assertion test with this exact test:

```ts
  it("maps a paid registration into readable sheet columns without child attendee JSON", () => {
    const row = paidRegistrationToRow({
      registrationId: "reg_123",
      stripeSessionId: "cs_test_123",
      paymentStatus: "paid",
      seatCount: 1,
      pricePerSeatCents: 5000,
      totalAmountCents: 5000,
      currency: "aud",
      createdAt: "2026-06-12T00:00:00.000Z",
      paidAt: "2026-06-12T00:05:00.000Z",
      primaryAttendee: {
        firstName: "Jane",
        lastName: "Citizen",
        mobile: "0412345678",
        email: "jane@example.com",
        church: "Central Church",
      },
      additionalAttendees: [
        { firstName: "John", lastName: "Citizen", church: "Central Church" },
      ],
    });

    expect(row).toEqual([
      "reg_123",
      "cs_test_123",
      "paid",
      "1",
      "5000",
      "5000",
      "aud",
      "Jane",
      "Citizen",
      "0412345678",
      "jane@example.com",
      "Central Church",
      "2026-06-12T00:00:00.000Z",
      "2026-06-12T00:05:00.000Z",
    ]);
  });
```

Add this test after the paid-row test:

```ts
  it("maps an additional attendee into a related child sheet row", () => {
    const row = additionalAttendeeToRow({
      registrationId: "reg_123",
      attendeeIndex: 1,
      createdAt: "2026-06-12T00:00:00.000Z",
      attendee: {
        firstName: "John",
        lastName: "Citizen",
        church: "North Church",
        mobile: "0499999999",
        email: "john@example.com",
        usesPrimaryContact: false,
      },
    });

    expect(row).toEqual([
      "reg_123",
      "1",
      "John",
      "Citizen",
      "North Church",
      "0499999999",
      "john@example.com",
      "false",
      "2026-06-12T00:00:00.000Z",
    ]);
  });
```

- [ ] **Step 2: Run mapper tests and verify failure**

Run:

```bash
npm test -- api/lib/__tests__/records.test.ts
```

Expected: FAIL because `additionalAttendeeToRow` is not exported and the current paid-row mapper still includes the additional-attendee JSON cell.

- [ ] **Step 3: Implement row-mapping changes**

In `api/lib/registration-records.ts`, replace the first import line with:

```ts
import type {
  AdditionalAttendee,
  PaidRegistrationRecord,
  RegistrationPayload,
} from "../../src/lib/registration.js";
```

Add this interface below `PendingRegistrationRecord`:

```ts
export interface AdditionalAttendeeRowRecord {
  registrationId: string;
  attendeeIndex: number;
  attendee: AdditionalAttendee;
  createdAt: string;
}
```

Replace `paidRegistrationToRow` with:

```ts
export function paidRegistrationToRow(record: PaidRegistrationRecord): string[] {
  return [
    record.registrationId,
    record.stripeSessionId,
    record.paymentStatus,
    String(record.seatCount),
    String(record.pricePerSeatCents),
    String(record.totalAmountCents),
    record.currency,
    record.primaryAttendee.firstName,
    record.primaryAttendee.lastName,
    record.primaryAttendee.mobile,
    record.primaryAttendee.email,
    record.primaryAttendee.church,
    record.createdAt,
    record.paidAt,
  ];
}
```

Add this function after `paidRegistrationToRow`:

```ts
export function additionalAttendeeToRow(record: AdditionalAttendeeRowRecord): string[] {
  return [
    record.registrationId,
    String(record.attendeeIndex),
    record.attendee.firstName,
    record.attendee.lastName,
    record.attendee.church,
    record.attendee.mobile ?? "",
    record.attendee.email ?? "",
    String(Boolean(record.attendee.usesPrimaryContact)),
    record.createdAt,
  ];
}
```

- [ ] **Step 4: Run mapper tests and verify pass**

Run:

```bash
npm test -- api/lib/__tests__/records.test.ts
```

Expected: PASS for all `registration record mapping` tests.

- [ ] **Step 5: Commit mapper changes**

Run:

```bash
git add api/lib/registration-records.ts api/lib/__tests__/records.test.ts
git commit -m "feat: map additional attendees to sheet rows"
```

---

### Task 2: Google Sheets Client Append Options

**Files:**
- Create: `api/lib/__tests__/google-sheets.test.ts`
- Modify: `api/lib/google-sheets.ts`

- [ ] **Step 1: Write failing Google Sheets client tests**

Create `api/lib/__tests__/google-sheets.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { append, get, sheets } = vi.hoisted(() => ({
  append: vi.fn(),
  get: vi.fn(),
  sheets: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: vi.fn(),
    },
    sheets,
  },
}));

const env = {
  googleSheetId: "sheet_123",
  googleClientEmail: "service@example.test",
  googlePrivateKey: "private-key",
};

describe("google sheets registration client", () => {
  beforeEach(() => {
    append.mockReset();
    get.mockReset();
    sheets.mockReset();
    sheets.mockReturnValue({
      spreadsheets: {
        values: {
          append,
          get,
        },
      },
    });
  });

  it("inserts a new row for pending registrations", async () => {
    const { createRegistrationSheetClient } = await import("../google-sheets.js");
    const client = createRegistrationSheetClient(env);

    await client.appendPendingRegistration({
      registrationId: "reg_123",
      createdAt: "2026-06-12T00:00:00.000Z",
      payload: {
        seatCount: 1,
        primaryAttendee: {
          firstName: "Jane",
          lastName: "Citizen",
          mobile: "0412345678",
          email: "jane@example.com",
          church: "Central Church",
        },
        additionalAttendees: [],
      },
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: "sheet_123",
        range: "PendingRegistrations!A:I",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
      }),
    );
  });

  it("inserts child rows for additional attendees", async () => {
    const { createRegistrationSheetClient } = await import("../google-sheets.js");
    const client = createRegistrationSheetClient(env);

    await client.appendAdditionalAttendees(
      "reg_123",
      "2026-06-12T00:00:00.000Z",
      [
        {
          firstName: "John",
          lastName: "Citizen",
          church: "North Church",
          mobile: "0499999999",
          email: "john@example.com",
          usesPrimaryContact: false,
        },
      ],
    );

    expect(append).toHaveBeenCalledWith({
      spreadsheetId: "sheet_123",
      range: "AdditionalAttendees!A:I",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            "reg_123",
            "1",
            "John",
            "Citizen",
            "North Church",
            "0499999999",
            "john@example.com",
            "false",
            "2026-06-12T00:00:00.000Z",
          ],
        ],
      },
    });
  });

  it("skips the additional attendee append when there are no child rows", async () => {
    const { createRegistrationSheetClient } = await import("../google-sheets.js");
    const client = createRegistrationSheetClient(env);

    await client.appendAdditionalAttendees("reg_123", "2026-06-12T00:00:00.000Z", []);

    expect(append).not.toHaveBeenCalled();
  });

  it("inserts a new row for paid registrations", async () => {
    const { createRegistrationSheetClient } = await import("../google-sheets.js");
    const client = createRegistrationSheetClient(env);

    await client.appendPaidRegistration({
      registrationId: "reg_123",
      stripeSessionId: "cs_test_123",
      paymentStatus: "paid",
      seatCount: 1,
      pricePerSeatCents: 5000,
      totalAmountCents: 5000,
      currency: "aud",
      createdAt: "2026-06-12T00:00:00.000Z",
      paidAt: "2026-06-12T00:05:00.000Z",
      primaryAttendee: {
        firstName: "Jane",
        lastName: "Citizen",
        mobile: "0412345678",
        email: "jane@example.com",
        church: "Central Church",
      },
      additionalAttendees: [],
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: "sheet_123",
        range: "PaidRegistrations!A:N",
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
      }),
    );
  });
});
```

- [ ] **Step 2: Run Google Sheets client tests and verify failure**

Run:

```bash
npm test -- api/lib/__tests__/google-sheets.test.ts
```

Expected: FAIL because `appendAdditionalAttendees` is missing, append calls do not pass `insertDataOption`, and `paidRange` is still `PaidRegistrations!A:O`.

- [ ] **Step 3: Implement Google Sheets client changes**

In `api/lib/google-sheets.ts`, replace the import section with:

```ts
import { google } from "googleapis";

import type { GoogleSheetsEnv } from "./env.js";
import type { AdditionalAttendee, PaidRegistrationRecord } from "../../src/lib/registration.js";
import {
  additionalAttendeeToRow,
  paidRegistrationToRow,
  pendingRegistrationToRow,
  rowToPendingRegistration,
  type PendingRegistrationRecord,
} from "./registration-records.js";
```

Replace the range constants with:

```ts
const pendingRange = "PendingRegistrations!A:I";
const paidRange = "PaidRegistrations!A:N";
const additionalAttendeesRange = "AdditionalAttendees!A:I";
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";
```

Update the `RegistrationSheetClient` interface to:

```ts
export interface RegistrationSheetClient {
  appendPendingRegistration(record: PendingRegistrationRecord): Promise<void>;
  appendAdditionalAttendees(
    registrationId: string,
    createdAt: string,
    attendees: AdditionalAttendee[],
  ): Promise<void>;
  findPendingRegistration(registrationId: string): Promise<PendingRegistrationRecord | null>;
  hasPaidSession(stripeSessionId: string): Promise<boolean>;
  appendPaidRegistration(record: PaidRegistrationRecord): Promise<void>;
}
```

In `appendPendingRegistration`, add `insertDataOption: "INSERT_ROWS"`:

```ts
    async appendPendingRegistration(record) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.googleSheetId,
        range: pendingRange,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [pendingRegistrationToRow(record)],
        },
      });
    },
```

Add `appendAdditionalAttendees` after `appendPendingRegistration`:

```ts
    async appendAdditionalAttendees(registrationId, createdAt, attendees) {
      if (attendees.length === 0) return;

      await sheets.spreadsheets.values.append({
        spreadsheetId: env.googleSheetId,
        range: additionalAttendeesRange,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: attendees.map((attendee, index) =>
            additionalAttendeeToRow({
              registrationId,
              attendeeIndex: index + 1,
              attendee,
              createdAt,
            }),
          ),
        },
      });
    },
```

In `appendPaidRegistration`, add `insertDataOption: "INSERT_ROWS"`:

```ts
    async appendPaidRegistration(record) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.googleSheetId,
        range: paidRange,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [paidRegistrationToRow(record)],
        },
      });
    },
```

- [ ] **Step 4: Run Google Sheets client tests and verify pass**

Run:

```bash
npm test -- api/lib/__tests__/google-sheets.test.ts
```

Expected: PASS for all `google sheets registration client` tests.

- [ ] **Step 5: Commit Google Sheets client changes**

Run:

```bash
git add api/lib/google-sheets.ts api/lib/__tests__/google-sheets.test.ts
git commit -m "feat: insert relational google sheets rows"
```

---

### Task 3: Checkout API Writes Child Attendees

**Files:**
- Modify: `api/lib/__tests__/checkout.test.ts`
- Modify: `api/create-checkout-session.ts`

- [ ] **Step 1: Write failing checkout tests**

In `api/lib/__tests__/checkout.test.ts`, replace the hoisted mock declaration with:

```ts
const {
  appendAdditionalAttendees,
  appendPendingRegistration,
  createCheckoutSession,
  getGoogleSheetsEnv,
} = vi.hoisted(() => ({
  appendAdditionalAttendees: vi.fn(),
  appendPendingRegistration: vi.fn(),
  createCheckoutSession: vi.fn(),
  getGoogleSheetsEnv: vi.fn(),
}));
```

Fix the `googleSheetsEnv` indentation:

```ts
const googleSheetsEnv = {
  googleSheetId: "sheet_123",
  googleClientEmail: "service@example.test",
  googlePrivateKey: "private-key",
};
```

Replace the Google Sheets mock with:

```ts
vi.mock("../google-sheets.js", () => ({
  createRegistrationSheetClient: () => ({
    appendAdditionalAttendees,
    appendPendingRegistration,
  }),
}));
```

In `beforeEach`, add:

```ts
    appendAdditionalAttendees.mockReset();
```

Replace the first test body with:

```ts
  it("creates pending registration rows, child attendee rows, and returns a checkout URL", async () => {
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    const { default: handler } = await import("../../create-checkout-session.js");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        body: {
          seatCount: 2,
          primaryAttendee: {
            firstName: "Jane",
            lastName: "Citizen",
            mobile: "0412345678",
            email: "jane@example.com",
            church: "Central Church",
          },
          additionalAttendees: [
            {
              firstName: "John",
              lastName: "Citizen",
              church: "North Church",
              mobile: "0499999999",
              email: "john@example.com",
              usesPrimaryContact: false,
            },
          ],
        },
      } as VercelRequest,
      response,
    );

    const pendingRecord = appendPendingRegistration.mock.calls[0][0];

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      checkoutUrl: "https://checkout.stripe.test/session",
    });
    expect(appendPendingRegistration).toHaveBeenCalledOnce();
    expect(appendAdditionalAttendees).toHaveBeenCalledWith(
      pendingRecord.registrationId,
      pendingRecord.createdAt,
      [
        {
          firstName: "John",
          lastName: "Citizen",
          church: "North Church",
          mobile: "0499999999",
          email: "john@example.com",
          usesPrimaryContact: false,
        },
      ],
    );
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        metadata: { registrationId: pendingRecord.registrationId },
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 5000, currency: "aud" }),
            quantity: 2,
          }),
        ],
      }),
    );
  });
```

In the storage-not-configured test, add:

```ts
    expect(appendAdditionalAttendees).not.toHaveBeenCalled();
```

In the invalid payload test, add:

```ts
    expect(appendAdditionalAttendees).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run checkout tests and verify failure**

Run:

```bash
npm test -- api/lib/__tests__/checkout.test.ts
```

Expected: FAIL because `appendAdditionalAttendees` is not called by `api/create-checkout-session.ts`.

- [ ] **Step 3: Implement checkout child-row write**

In `api/create-checkout-session.ts`, replace the Google Sheets write block with:

```ts
  if (googleSheetsEnv) {
    const sheetClient = createRegistrationSheetClient(googleSheetsEnv);
    await sheetClient.appendPendingRegistration({ registrationId, createdAt, payload });
    await sheetClient.appendAdditionalAttendees(
      registrationId,
      createdAt,
      payload.additionalAttendees,
    );
  }
```

- [ ] **Step 4: Run checkout tests and verify pass**

Run:

```bash
npm test -- api/lib/__tests__/checkout.test.ts
```

Expected: PASS for all `create checkout session API` tests.

- [ ] **Step 5: Commit checkout changes**

Run:

```bash
git add api/create-checkout-session.ts api/lib/__tests__/checkout.test.ts
git commit -m "feat: write additional attendees before checkout"
```

---

### Task 4: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README Google Sheets setup**

In `README.md`, replace the Google Sheets setup steps from the `PendingRegistrations` header block through the credential step with:

````md
1. Create a Google Sheet for registrations.
2. Add a `PendingRegistrations` tab with these headers:

   ```text
   registrationId, createdAt, seatCount, primaryFirstName, primaryLastName, primaryMobile, primaryEmail, primaryChurch, additionalAttendees
   ```

3. Add a `PaidRegistrations` tab with these headers:

   ```text
   registrationId, stripeSessionId, paymentStatus, seatCount, pricePerSeatCents, totalAmountCents, currency, primaryFirstName, primaryLastName, primaryMobile, primaryEmail, primaryChurch, createdAt, paidAt
   ```

4. Add an `AdditionalAttendees` tab with these headers:

   ```text
   registrationId, attendeeIndex, firstName, lastName, church, mobile, email, usesPrimaryContact, createdAt
   ```

5. Create a Google Cloud service account with Google Sheets API access.
6. Share the registration sheet with the service account email.
7. Set `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, and `GOOGLE_PRIVATE_KEY` in Vercel.
````

Replace sandbox verification steps 2 and 5 with:

```md
2. Submit the form with one primary attendee and at least one additional attendee.
```

```md
5. Confirm a paid row appears in the `PaidRegistrations` tab and related guest rows appear in the `AdditionalAttendees` tab with the same `registrationId`.
```

- [ ] **Step 2: Review README diff**

Run:

```bash
git diff -- README.md
```

Expected: The diff shows the new `AdditionalAttendees` tab, the revised paid headers without `additionalAttendees`, renumbered setup steps, and verification text that references related guest rows.

- [ ] **Step 3: Commit README changes**

Run:

```bash
git add README.md
git commit -m "docs: document relational sheets tabs"
```

---

### Task 5: Full Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- api/lib/__tests__/records.test.ts api/lib/__tests__/google-sheets.test.ts api/lib/__tests__/checkout.test.ts api/lib/__tests__/webhook.test.ts
```

Expected: PASS for the records, Google Sheets client, checkout, and webhook tests.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS for all Vitest suites.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS with TypeScript and Vite build success.

- [ ] **Step 5: Inspect final git status**

Run:

```bash
git status --short
```

Expected: Only intentional source, test, README, and plan/spec files from this branch are present. If a verification command failed before this step, fix the reported source or test file, rerun the failed command, and make a normal descriptive commit for the exact file paths shown by `git status --short`.

- [ ] **Step 6: Push branch and update PR**

Run:

```bash
git push -u origin cursor/google-sheets-relational-rows-d63d
```

Expected: Push succeeds and updates the branch backing the draft PR.

---

## Self-Review

- Spec coverage: Tasks 1 and 2 cover row insertion, row mappers, `AdditionalAttendees`, and paid header changes. Task 3 covers pre-payment child writes. Task 4 covers README setup and verification. Task 5 covers full verification.
- Placeholder scan: This plan contains concrete paths, code snippets, commands, and expected outcomes.
- Type consistency: `appendAdditionalAttendees(registrationId, createdAt, attendees)` is defined in Task 2 and consumed in Task 3. `AdditionalAttendeeRowRecord` is defined before `additionalAttendeeToRow` is used by the Sheets client.
