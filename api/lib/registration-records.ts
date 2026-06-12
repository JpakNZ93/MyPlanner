import type { PaidRegistrationRecord, RegistrationPayload } from "../../src/lib/registration";

export interface PendingRegistrationRecord {
  registrationId: string;
  createdAt: string;
  payload: RegistrationPayload;
}

export function pendingRegistrationToRow(record: PendingRegistrationRecord): string[] {
  return [record.registrationId, record.createdAt, JSON.stringify(record.payload)];
}

export function rowToPendingRegistration(row: string[]): PendingRegistrationRecord {
  return {
    registrationId: row[0],
    createdAt: row[1],
    payload: JSON.parse(row[2]) as RegistrationPayload,
  };
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
