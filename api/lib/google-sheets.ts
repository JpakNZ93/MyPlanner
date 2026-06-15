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

const pendingRange = "PendingRegistrations!A:I";
const paidRange = "PaidRegistrations!A:N";
const additionalAttendeesRange = "AdditionalAttendees!A:I";
const sheetsScope = "https://www.googleapis.com/auth/spreadsheets";

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

export function createRegistrationSheetClient(env: GoogleSheetsEnv): RegistrationSheetClient {
  const auth = new google.auth.JWT({
    email: env.googleClientEmail,
    key: env.googlePrivateKey,
    scopes: [sheetsScope],
  });
  const sheets = google.sheets({ version: "v4", auth });

  return {
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

    async findPendingRegistration(registrationId) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: env.googleSheetId,
        range: pendingRange,
      });
      const rows = response.data.values ?? [];
      const row = rows.find((candidate) => candidate[0] === registrationId);

      return row ? rowToPendingRegistration(row as string[]) : null;
    },

    async hasPaidSession(stripeSessionId) {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: env.googleSheetId,
        range: paidRange,
      });
      const rows = response.data.values ?? [];

      return rows.some((row) => row[1] === stripeSessionId);
    },

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
  };
}
