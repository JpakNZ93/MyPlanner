# Seat Stepper Buttons Design

## Summary

Replace the editable "Number of seats" numeric input with a button-only stepper. The registration form will show a minus button, the current seat count as read-only text, and a plus button.

## User Experience

The Seats fieldset keeps the existing "Number of seats" label and helper text. Users adjust the seat count only with the minus and plus buttons:

- The minus button decreases the count by one.
- The plus button increases the count by one.
- The current seat count is displayed between the buttons as non-editable text.
- The minus button is disabled at the minimum of 1 seat.
- The plus button is disabled at the maximum of 10 seats.
- The total amount updates immediately when the count changes.

## Components and State

The change stays inside `src/App.tsx` and `src/styles.css`.

`RegistrationPage` will keep the existing `seatCount` state, `clampSeatCount` helper, and `adjustSeatCount` behavior. The typed-input change handler becomes unnecessary because users can no longer type a value directly.

The seat count display should remain accessible by the "Number of seats" label. A read-only element with an appropriate ARIA value role or label should expose the selected number to assistive technology without presenting it as an editable input.

## Data Flow

Seat count continues to flow through the existing registration path:

1. User presses plus or minus.
2. `adjustSeatCount` clamps the next value between 1 and `MAX_SEAT_COUNT`.
3. `totalAmount` recalculates from `calculateTotalAmount(seatCount)`.
4. On submit, `normalizeRegistration` receives the current `seatCount`.

Additional attendee behavior remains unchanged: adding an attendee can increase the seat count, and removing an attendee can decrease it.

## Error Handling

No new error state is needed. Boundary conditions are handled by disabled buttons and the existing clamp helper. Server-side and schema validation remain unchanged.

## Testing

Update the app tests to assert the button-only behavior:

- The seat count display starts at 1.
- Clicking plus increments the display and enables minus.
- Clicking minus decrements the display.
- The plus button disables at 10 seats.
- There is no editable spinbutton/textbox for direct seat entry.

Existing registration submission tests should continue to validate that the selected seat count reaches checkout through the current form submission path.
