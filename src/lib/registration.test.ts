import { describe, expect, it } from "vitest";
import {
  PRICE_PER_SEAT_CENTS,
  calculateTotalAmount,
  normalizeRegistration,
  registrationSchema,
} from "./registration";

describe("registration helpers", () => {
  it("accepts a valid primary attendee and calculates AUD 50 per seat", () => {
    const result = registrationSchema.safeParse({
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
          church: "Central Church",
          usesPrimaryContact: true,
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(PRICE_PER_SEAT_CENTS).toBe(5000);
    expect(calculateTotalAmount(2)).toBe(10000);
  });

  it("rejects missing primary attendee details", () => {
    const result = registrationSchema.safeParse({
      seatCount: 1,
      primaryAttendee: {
        firstName: "",
        lastName: "",
        mobile: "",
        email: "not-email",
        church: "",
      },
      additionalAttendees: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a seat count lower than attendee rows", () => {
    const result = registrationSchema.safeParse({
      seatCount: 1,
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

    expect(result.success).toBe(false);
  });

  it("rejects a seat count above 10", () => {
    const result = registrationSchema.safeParse({
      seatCount: 11,
      primaryAttendee: {
        firstName: "Jane",
        lastName: "Citizen",
        mobile: "0412345678",
        email: "jane@example.com",
        church: "Central Church",
      },
      additionalAttendees: [],
    });

    expect(result.success).toBe(false);
  });

  it("trims strings and removes blank additional attendee rows", () => {
    const normalized = normalizeRegistration({
      seatCount: 3,
      primaryAttendee: {
        firstName: " Jane ",
        lastName: " Citizen ",
        mobile: " 0412345678 ",
        email: " JANE@EXAMPLE.COM ",
        church: " Central Church ",
      },
      additionalAttendees: [
        { firstName: " ", lastName: "", church: "", usesPrimaryContact: false },
        { firstName: " John ", lastName: " Citizen ", church: " Central Church " },
      ],
    });

    expect(normalized.primaryAttendee.firstName).toBe("Jane");
    expect(normalized.primaryAttendee.email).toBe("jane@example.com");
    expect(normalized.additionalAttendees).toHaveLength(1);
  });

  it("allows whitespace-only optional additional attendee email on blank rows", () => {
    const input = {
      seatCount: 1,
      primaryAttendee: {
        firstName: "Jane",
        lastName: "Citizen",
        mobile: "0412345678",
        email: "jane@example.com",
        church: "Central Church",
      },
      additionalAttendees: [
        { firstName: "", lastName: "", church: "", email: "   " },
      ],
    };

    let normalized: ReturnType<typeof normalizeRegistration> | undefined;

    expect(() => {
      normalized = normalizeRegistration(input);
    }).not.toThrow();
    expect(normalized?.additionalAttendees).toHaveLength(0);
  });
});
