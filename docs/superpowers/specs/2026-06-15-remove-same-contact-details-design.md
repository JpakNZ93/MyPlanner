# Remove Same Contact Details Design

## Summary

Remove the "Use same contact details" option from additional attendee rows. Additional attendee mobile and email fields remain optional, but they are always visible when an additional attendee row is shown.

## User Experience

Additional attendee rows will include:

- first name
- last name
- church
- mobile number
- email address
- remove attendee button

The checkbox labelled "Use same contact details" will no longer appear. Users who do not know an additional attendee's mobile or email can leave those optional fields blank and still continue checkout, matching the existing helper text: "Add guest details now or leave them blank and provide them later."

## Frontend State and UI

`src/App.tsx` should remove `usesPrimaryContact` from the additional attendee form state. New additional attendee rows should only track:

- `id`
- `firstName`
- `lastName`
- `church`
- `mobile`
- `email`

The additional attendee mobile and email inputs should always render. The conditional rendering that hides those inputs when `usesPrimaryContact` is true should be removed.

## Registration Data Compatibility

New frontend submissions should not include `usesPrimaryContact` for additional attendees.

The shared registration parser can continue accepting the optional `usesPrimaryContact` field for backwards compatibility with older pending records, tests, or API callers. However, normalization should no longer copy primary attendee mobile/email into additional attendee records based on `usesPrimaryContact`. Additional attendee contact fields should come only from that additional attendee row.

This avoids breaking older inputs while removing the reuse-primary-contact behavior from the current product flow.

## Documentation

`README.md` should no longer list a same-contact checkbox as a feature. The additional attendee feature description should stay focused on adding/removing attendees and optional contact details.

## Testing

Update frontend tests to verify:

- Adding an additional attendee still shows first name, last name, church, mobile, and email fields.
- The "Use same contact details" checkbox is absent.
- Submitting an additional attendee with distinct optional contact details still sends those mobile/email values.

Remove or replace the frontend test that expects primary contact details to be copied to an additional attendee.

Update registration helper tests to verify that an older input with `usesPrimaryContact: true` no longer copies primary contact details into the normalized additional attendee record.

## Out of Scope

- Making additional attendee mobile/email required.
- Changing Stripe, Google Sheets, or email notification behavior.
- Migrating historical Google Sheets data.
- Removing every backend type mention of `usesPrimaryContact` if doing so would break compatibility with older data.
