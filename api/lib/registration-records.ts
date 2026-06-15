import type { PaidRegistrationRecord, RegistrationPayload } from "../../src/lib/registration.js";

export interface PendingRegistrationRecord {
  registrationId: string;
  createdAt: string;
  payload: RegistrationPayload;
}

export function pendingRegistrationToRow(record: PendingRegistrationRecord): string[] {
  return [
    record.registrationId,
    record.createdAt,
    String(record.payload.seatCount),
    record.payload.primaryAttendee.firstName,
    record.payload.primaryAttendee.lastName,
    record.payload.primaryAttendee.mobile,
    record.payload.primaryAttendee.email,
    record.payload.primaryAttendee.church,
    JSON.stringify(record.payload.additionalAttendees),
  ];
}

export function rowToPendingRegistration(row: string[]): PendingRegistrationRecord {
  if (isLegacyPendingRow(row)) {
    return {
      registrationId: row[0],
      createdAt: row[1],
      payload: JSON.parse(row[2]) as RegistrationPayload,
    };
  }

  return {
    registrationId: row[0],
    createdAt: row[1],
    payload: {
      seatCount: Number(row[2]),
      primaryAttendee: {
        firstName: row[3] ?? "",
        lastName: row[4] ?? "",
        mobile: row[5] ?? "",
        email: row[6] ?? "",
        church: row[7] ?? "",
      },
      additionalAttendees: row[8] ? JSON.parse(row[8]) : [],
    },
  };
}

function isLegacyPendingRow(row: string[]): boolean {
  return row.length === 3 && row[2]?.trim().startsWith("{");
}

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
    JSON.stringify(record.additionalAttendees),
    record.createdAt,
    record.paidAt,
  ];
}
