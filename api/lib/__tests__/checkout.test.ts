import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { appendPendingRegistration, createCheckoutSession } = vi.hoisted(() => ({
  appendPendingRegistration: vi.fn(),
  createCheckoutSession: vi.fn(),
}));

vi.mock("../env.js", () => ({
  getServerEnv: () => ({
    appUrl: "https://example.test",
    stripeSecretKey: "sk_test_123",
    stripeWebhookSecret: "whsec_123",
    googleSheetId: "sheet_123",
    googleClientEmail: "service@example.test",
    googlePrivateKey: "private-key",
    resendApiKey: "re_123",
    notificationEmail: "registrations@example.test",
    emailFrom: "Events <events@example.test>",
  }),
}));

vi.mock("../google-sheets.js", () => ({
  createRegistrationSheetClient: () => ({ appendPendingRegistration }),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return {
      checkout: { sessions: { create: createCheckoutSession } },
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

describe("create checkout session API", () => {
  beforeEach(() => {
    appendPendingRegistration.mockReset();
    createCheckoutSession.mockReset();
  });

  it("creates a pending registration and returns a checkout URL", async () => {
    createCheckoutSession.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    const { default: handler } = await import("../../create-checkout-session.js");
    const response = createResponse();

    await handler(
      {
        method: "POST",
        body: {
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
      } as VercelRequest,
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      checkoutUrl: "https://checkout.stripe.test/session",
    });
    expect(appendPendingRegistration).toHaveBeenCalledOnce();
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({ unit_amount: 5000, currency: "aud" }),
            quantity: 1,
          }),
        ],
      }),
    );
  });

  it("rejects invalid payloads", async () => {
    const { default: handler } = await import("../../create-checkout-session.js");
    const response = createResponse();

    await handler({ method: "POST", body: { seatCount: 0 } } as VercelRequest, response);

    expect(response.statusCode).toBe(400);
    expect(appendPendingRegistration).not.toHaveBeenCalled();
  });
});
