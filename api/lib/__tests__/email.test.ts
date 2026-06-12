import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function ResendMock() {
    return {
      emails: { send: sendEmail },
    };
  }),
}));

const env = {
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

const paidRecord = {
  registrationId: "reg_123",
  stripeSessionId: "cs_test_123",
  paymentStatus: "paid" as const,
  seatCount: 1,
  pricePerSeatCents: 5000,
  totalAmountCents: 5000,
  currency: "aud" as const,
  createdAt: "2026-06-12T00:00:00.000Z",
  paidAt: "2026-06-12T00:10:00.000Z",
  primaryAttendee: {
    firstName: "Jane",
    lastName: "Citizen",
    mobile: "0412345678",
    email: "jane@example.com",
    church: "Central Church",
  },
  additionalAttendees: [],
};

describe("registration email", () => {
  beforeEach(() => {
    sendEmail.mockReset();
  });

  it("includes the event title in the notification body", async () => {
    sendEmail.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
    });
    const { sendRegistrationEmail } = await import("../email");

    await sendRegistrationEmail(env, paidRecord);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining("Event: Youth Conference"),
      }),
    );
  });

  it("throws when Resend resolves with an error", async () => {
    sendEmail.mockResolvedValue({
      data: null,
      error: { message: "Invalid recipient address" },
    });
    const { sendRegistrationEmail } = await import("../email");

    await expect(sendRegistrationEmail(env, paidRecord)).rejects.toThrow(
      "Invalid recipient address",
    );
  });
});
