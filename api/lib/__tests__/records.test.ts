import { describe, expect, it } from "vitest";
import {
  paidRegistrationToRow,
  pendingRegistrationToRow,
  rowToPendingRegistration,
} from "../registration-records.js";

describe("registration record mapping", () => {
  it("maps pending registration rows into readable sheet columns", () => {
    const row = pendingRegistrationToRow({
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

    expect(row).toEqual([
      "reg_123",
      "2026-06-12T00:00:00.000Z",
      "2",
      "Jane",
      "Citizen",
      "0412345678",
      "jane@example.com",
      "Central Church",
      JSON.stringify([{ firstName: "John", lastName: "Citizen", church: "Central Church" }]),
    ]);
    expect(rowToPendingRegistration(row)).toEqual({
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
  });

  it("reads legacy pending rows with a payload JSON column", () => {
    const row = [
      "reg_123",
      "2026-06-12T00:00:00.000Z",
      JSON.stringify({
        seatCount: 1,
        primaryAttendee: {
          firstName: "Jane",
          lastName: "Citizen",
          mobile: "0412345678",
          email: "jane@example.com",
          church: "Central Church",
        },
        additionalAttendees: [],
      }),
    ];

    expect(rowToPendingRegistration(row)).toEqual({
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
  });

  it("maps a paid registration into readable sheet columns", () => {
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
      additionalAttendees: [],
    });

    expect(row).toContain("reg_123");
    expect(row).toContain("cs_test_123");
    expect(row).toContain("Jane");
    expect(row).toContain("[]");
  });
});
