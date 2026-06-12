import { z } from "zod";

export const CURRENCY = "aud";
export const DISPLAY_CURRENCY = "AUD";
export const PRICE_PER_SEAT_CENTS = 5000;

export interface PrimaryAttendee {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  church: string;
}

export interface AdditionalAttendee {
  firstName: string;
  lastName: string;
  church: string;
  mobile?: string;
  email?: string;
  usesPrimaryContact?: boolean;
}

export interface RegistrationPayload {
  seatCount: number;
  primaryAttendee: PrimaryAttendee;
  additionalAttendees: AdditionalAttendee[];
}

export interface PaidRegistrationRecord extends RegistrationPayload {
  registrationId: string;
  stripeSessionId: string;
  paymentStatus: "paid";
  pricePerSeatCents: number;
  totalAmountCents: number;
  currency: typeof CURRENCY;
  createdAt: string;
  paidAt: string;
}

const requiredString = z.string().trim().min(1);
const optionalString = z.string().trim().optional();

export const primaryAttendeeSchema = z.object({
  firstName: requiredString,
  lastName: requiredString,
  mobile: requiredString,
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  church: requiredString,
});

export const additionalAttendeeSchema = z.object({
  firstName: optionalString.default(""),
  lastName: optionalString.default(""),
  church: optionalString.default(""),
  mobile: optionalString,
  email: z
    .string()
    .trim()
    .email()
    .transform((email) => email.toLowerCase())
    .optional()
    .or(z.literal("")),
  usesPrimaryContact: z.boolean().optional().default(false),
});

export const registrationSchema = z
  .object({
    seatCount: z.coerce.number().int().min(1),
    primaryAttendee: primaryAttendeeSchema,
    additionalAttendees: z.array(additionalAttendeeSchema).default([]),
  })
  .superRefine((registration, context) => {
    const enteredAdditionalAttendees = registration.additionalAttendees.filter(hasAttendeeDetails);
    const attendeeRows = 1 + enteredAdditionalAttendees.length;

    if (registration.seatCount < attendeeRows) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Seat count must be at least the number of attendee rows.",
        path: ["seatCount"],
      });
    }
  });

export function hasAttendeeDetails(attendee: AdditionalAttendee): boolean {
  return Boolean(
    attendee.firstName.trim() ||
      attendee.lastName.trim() ||
      attendee.church.trim() ||
      attendee.mobile?.trim() ||
      attendee.email?.trim(),
  );
}

export function normalizeRegistration(input: unknown): RegistrationPayload {
  const parsed = registrationSchema.parse(input);
  const additionalAttendees = parsed.additionalAttendees
    .filter(hasAttendeeDetails)
    .map((attendee) => ({
      firstName: attendee.firstName.trim(),
      lastName: attendee.lastName.trim(),
      church: attendee.church.trim(),
      mobile: attendee.usesPrimaryContact ? parsed.primaryAttendee.mobile : attendee.mobile?.trim(),
      email: attendee.usesPrimaryContact
        ? parsed.primaryAttendee.email
        : attendee.email?.trim().toLowerCase(),
      usesPrimaryContact: attendee.usesPrimaryContact,
    }));

  return {
    seatCount: parsed.seatCount,
    primaryAttendee: {
      firstName: parsed.primaryAttendee.firstName.trim(),
      lastName: parsed.primaryAttendee.lastName.trim(),
      mobile: parsed.primaryAttendee.mobile.trim(),
      email: parsed.primaryAttendee.email.trim().toLowerCase(),
      church: parsed.primaryAttendee.church.trim(),
    },
    additionalAttendees,
  };
}

export function calculateTotalAmount(seatCount: number): number {
  return seatCount * PRICE_PER_SEAT_CENTS;
}
