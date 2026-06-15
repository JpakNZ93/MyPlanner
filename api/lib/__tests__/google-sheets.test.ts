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
