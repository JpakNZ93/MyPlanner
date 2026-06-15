import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  appendPaidRegistration,
  constructEvent,
  findPendingRegistration,
  getEmailEnv,
  getGoogleSheetsEnv,
  hasPaidSession,
  sendRegistrationEmail,
} = vi.hoisted(() => ({
  appendPaidRegistration: vi.fn(),
  constructEvent: vi.fn(),
  findPendingRegistration: vi.fn(),
  getEmailEnv: vi.fn(),
  getGoogleSheetsEnv: vi.fn(),
  hasPaidSession: vi.fn(),
  sendRegistrationEmail: vi.fn(),
}));

const serverEnv = {
  appUrl: "https://example.test",
  stripeSecretKey: "sk_test_123",
  stripeWebhookSecret: "whsec_123",
  googleSheetId: "sheet_123",
  googleClientEmail: "service@example.test",
  googlePrivateKey: "private-key",
  resendApiKey: "re_123",
  notificationEmail: "registrations@example.test",
  emailFrom: "Events <events@example.test>",
  eventTitle: "Youth Conference",
};

vi.mock("../env.js", () => ({
  getEmailEnv,
  getGoogleSheetsEnv,
  getWebhookEnv: () => serverEnv,
}));

vi.mock("../google-sheets.js", () => ({
  createRegistrationSheetClient: () => ({
    appendPaidRegistration,
    findPendingRegistration,
    hasPaidSession,
  }),
}));

vi.mock("../email.js", () => ({
  sendRegistrationEmail,
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return {
      webhooks: { constructEvent },
    };
  }),
}));

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    end(body: string) {
      this.body = body;
      return this;
    },
  };

  return response as unknown as VercelResponse & typeof response;
}

function createRequest(body = "raw-stripe-body") {
  return {
    method: "POST",
    headers: { "stripe-signature": "sig_123" },
    body,
  } as unknown as VercelRequest;
}

function checkoutCompletedEvent(session: Record<string, unknown>) {
  return {
    type: "checkout.session.completed",
    data: { object: session },
  };
}

describe("stripe webhook API", () => {
  beforeEach(() => {
    appendPaidRegistration.mockReset();
    constructEvent.mockReset();
    findPendingRegistration.mockReset();
    getEmailEnv.mockReset();
    getGoogleSheetsEnv.mockReset();
    hasPaidSession.mockReset();
    sendRegistrationEmail.mockReset();
    getEmailEnv.mockReturnValue(serverEnv);
    getGoogleSheetsEnv.mockReturnValue(serverEnv);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-12T00:10:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("records and emails a paid checkout session", async () => {
    constructEvent.mockReturnValue(
      checkoutCompletedEvent({
        id: "cs_test_123",
        payment_status: "paid",
        metadata: { registrationId: "reg_123" },
      }),
    );
    hasPaidSession.mockResolvedValue(false);
    findPendingRegistration.mockResolvedValue({
      registrationId: "reg_123",
      createdAt: "2026-06-12T00:00:00.000Z",
      payload: {
        seatCount: 2,
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
      },
    });
    const { default: handler } = await import("../../stripe-webhook.js");
    const response = createResponse();

    await handler(createRequest(), response);

    const paidRecord = {
      registrationId: "reg_123",
      stripeSessionId: "cs_test_123",
      paymentStatus: "paid",
      seatCount: 2,
      pricePerSeatCents: 5000,
      totalAmountCents: 10000,
      currency: "aud",
      createdAt: "2026-06-12T00:00:00.000Z",
      paidAt: "2026-06-12T00:10:00.000Z",
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
    };
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
    expect(constructEvent).toHaveBeenCalledWith("raw-stripe-body", "sig_123", "whsec_123");
    expect(hasPaidSession).toHaveBeenCalledWith("cs_test_123");
    expect(findPendingRegistration).toHaveBeenCalledWith("reg_123");
    expect(appendPaidRegistration).toHaveBeenCalledWith(paidRecord);
    expect(sendRegistrationEmail).toHaveBeenCalledWith(serverEnv, paidRecord);
  });

  it("acknowledges paid checkout sessions when registration storage is not configured", async () => {
    getGoogleSheetsEnv.mockReturnValue(null);
    constructEvent.mockReturnValue(
      checkoutCompletedEvent({
        id: "cs_test_123",
        payment_status: "paid",
        metadata: { registrationId: "reg_123" },
      }),
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { default: handler } = await import("../../stripe-webhook.js");
    const response = createResponse();

    await handler(createRequest(), response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true, storage: "not_configured" });
    expect(hasPaidSession).not.toHaveBeenCalled();
    expect(findPendingRegistration).not.toHaveBeenCalled();
    expect(appendPaidRegistration).not.toHaveBeenCalled();
    expect(sendRegistrationEmail).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith("Registration storage is not configured");
    consoleWarn.mockRestore();
  });

  it("ignores duplicate paid sessions", async () => {
    constructEvent.mockReturnValue(
      checkoutCompletedEvent({
        id: "cs_test_123",
        payment_status: "paid",
        metadata: { registrationId: "reg_123" },
      }),
    );
    hasPaidSession.mockResolvedValue(true);
    const { default: handler } = await import("../../stripe-webhook.js");
    const response = createResponse();

    await handler(createRequest(), response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true, duplicate: true });
    expect(hasPaidSession).toHaveBeenCalledWith("cs_test_123");
    expect(findPendingRegistration).not.toHaveBeenCalled();
    expect(appendPaidRegistration).not.toHaveBeenCalled();
    expect(sendRegistrationEmail).not.toHaveBeenCalled();
  });

  it("returns 200 when email fails after appending the paid registration", async () => {
    constructEvent.mockReturnValue(
      checkoutCompletedEvent({
        id: "cs_test_123",
        payment_status: "paid",
        metadata: { registrationId: "reg_123" },
      }),
    );
    hasPaidSession.mockResolvedValue(false);
    findPendingRegistration.mockResolvedValue({
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
    sendRegistrationEmail.mockRejectedValue(new Error("Resend failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { default: handler } = await import("../../stripe-webhook.js");
    const response = createResponse();

    await handler(createRequest(), response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
    expect(appendPaidRegistration).toHaveBeenCalledOnce();
    expect(sendRegistrationEmail).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to send registration email",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("returns 200 when email environment validation fails after appending the paid registration", async () => {
    constructEvent.mockReturnValue(
      checkoutCompletedEvent({
        id: "cs_test_123",
        payment_status: "paid",
        metadata: { registrationId: "reg_123" },
      }),
    );
    hasPaidSession.mockResolvedValue(false);
    findPendingRegistration.mockResolvedValue({
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
    getEmailEnv.mockImplementation(() => {
      throw new Error("Email notifications require RESEND_API_KEY, NOTIFICATION_EMAIL, and EMAIL_FROM");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { default: handler } = await import("../../stripe-webhook.js");
    const response = createResponse();

    await handler(createRequest(), response);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
    expect(appendPaidRegistration).toHaveBeenCalledOnce();
    expect(sendRegistrationEmail).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to send registration email",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("returns a retryable 500 and does not email when paid registration append fails", async () => {
    constructEvent.mockReturnValue(
      checkoutCompletedEvent({
        id: "cs_test_123",
        payment_status: "paid",
        metadata: { registrationId: "reg_123" },
      }),
    );
    hasPaidSession.mockResolvedValue(false);
    findPendingRegistration.mockResolvedValue({
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
    appendPaidRegistration.mockRejectedValue(new Error("Google Sheets append failed"));
    const { default: handler } = await import("../../stripe-webhook.js");
    const response = createResponse();

    await handler(createRequest(), response);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: "Paid registration could not be saved" });
    expect(appendPaidRegistration).toHaveBeenCalledOnce();
    expect(sendRegistrationEmail).not.toHaveBeenCalled();
  });

  it("passes the streamed raw body to Stripe signature verification", async () => {
    constructEvent.mockReturnValue({ type: "customer.created", data: { object: {} } });
    const { default: handler } = await import("../../stripe-webhook.js");
    const request = Object.assign(Readable.from(["streamed-stripe-body"]), {
      method: "POST",
      headers: { "stripe-signature": "sig_123" },
    }) as unknown as VercelRequest;
    const response = createResponse();

    await handler(request, response);

    const rawBody = constructEvent.mock.calls[0][0] as Buffer;
    expect(Buffer.isBuffer(rawBody)).toBe(true);
    expect(rawBody.toString()).toBe("streamed-stripe-body");
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
  });
});
