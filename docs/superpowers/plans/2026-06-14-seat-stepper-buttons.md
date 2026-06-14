# Seat Stepper Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editable seat-count number input with a plus/minus-only stepper that displays the current count as read-only text.

**Architecture:** Keep the existing `RegistrationPage` state and seat adjustment helper. Swap the seat input for a label-associated `<output>` element, update styles for the display, and adjust React Testing Library assertions to use the read-only display instead of an editable numeric input.

**Tech Stack:** Vite, React, TypeScript, Vitest, React Testing Library, CSS.

---

## File Structure

- Modify `src/App.test.tsx`: update seat picker tests to assert button-only behavior and remove direct typed seat-count changes.
- Modify `src/App.tsx`: remove the typed seat-count input and render a non-editable `<output>` between the existing plus/minus buttons.
- Modify `src/styles.css`: style the `<output>` count display so it aligns visually with the existing stepper.

---

## Task 1: Update Seat Stepper Tests

**Files:**
- Modify: `src/App.test.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Replace editable input assertions with read-only display assertions**

In `src/App.test.tsx`, replace the first three seat-related tests with this code:

```tsx
  it("adds and removes additional attendees", async () => {
    const user = userEvent.setup();
    render(<App />);

    const seatCountDisplay = screen.getByLabelText(/number of seats/i);
    await user.click(screen.getByRole("button", { name: /add another attendee/i }));
    expect(seatCountDisplay).toHaveTextContent("2");
    expect(screen.getByLabelText(/additional attendee 1 first name/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove attendee 1/i }));
    expect(seatCountDisplay).toHaveTextContent("1");
    expect(screen.queryByLabelText(/additional attendee 1 first name/i)).not.toBeInTheDocument();
  });

  it("increments the seat count when adding another attendee", async () => {
    const user = userEvent.setup();
    render(<App />);

    const seatCountDisplay = screen.getByLabelText(/number of seats/i);
    await user.click(screen.getByRole("button", { name: /increase seats/i }));
    await user.click(screen.getByRole("button", { name: /increase seats/i }));
    await user.click(screen.getByRole("button", { name: /add another attendee/i }));

    expect(seatCountDisplay).toHaveTextContent("4");
  });

  it("renders a button-only seat stepper limited to 10 seats", async () => {
    const user = userEvent.setup();
    render(<App />);

    const seatCountDisplay = screen.getByLabelText(/number of seats/i);
    const decreaseButton = screen.getByRole("button", { name: /decrease seats/i });
    const increaseButton = screen.getByRole("button", { name: /increase seats/i });

    expect(seatCountDisplay).toHaveTextContent("1");
    expect(screen.queryByRole("spinbutton", { name: /number of seats/i })).not.toBeInTheDocument();
    expect(decreaseButton).toBeDisabled();

    await user.click(increaseButton);

    expect(seatCountDisplay).toHaveTextContent("2");
    expect(decreaseButton).toBeEnabled();

    for (let count = 2; count < 10; count += 1) {
      await user.click(increaseButton);
    }

    expect(seatCountDisplay).toHaveTextContent("10");
    expect(increaseButton).toBeDisabled();
  });
```

- [ ] **Step 2: Remove the typed clamping test**

Delete this test from `src/App.test.tsx` because direct typing will no longer be supported:

```tsx
  it("clamps typed seat counts to the 10 seat maximum", () => {
    render(<App />);

    const seatCountInput = screen.getByLabelText(/number of seats/i);
    fireEvent.change(seatCountInput, { target: { value: "11" } });

    expect(seatCountInput).toHaveValue(10);
  });
```

- [ ] **Step 3: Remove the unused `fireEvent` import**

At the top of `src/App.test.tsx`, change:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
```

to:

```tsx
import { cleanup, render, screen, waitFor } from "@testing-library/react";
```

- [ ] **Step 4: Run the app tests to verify the new tests fail**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `screen.queryByRole("spinbutton", { name: /number of seats/i })` still finds the existing numeric input, and the output-specific text assertions are not yet satisfied.

- [ ] **Step 5: Commit the failing tests**

Run:

```bash
git add src/App.test.tsx
git commit -m "test: expect button-only seat stepper"
git push -u origin cursor/seat-stepper-buttons-1e2d
```

---

## Task 2: Implement the Button-Only Seat Stepper

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Remove typed-input handling from imports and component**

In `src/App.tsx`, change:

```tsx
import { useState, type ChangeEvent, type FormEvent } from "react";
```

to:

```tsx
import { useState, type FormEvent } from "react";
```

Then delete the `updateSeatCount` function:

```tsx
  const updateSeatCount = (event: ChangeEvent<HTMLInputElement>) => {
    setSeatCount(clampSeatCount(Number(event.target.value)));
  };
```

- [ ] **Step 2: Replace the numeric input with a label-associated output**

In `src/App.tsx`, replace the current `<input>` inside `.seat-picker`:

```tsx
                  <input
                    aria-describedby="seat-count-help"
                    id="seat-count"
                    inputMode="numeric"
                    max={MAX_SEAT_COUNT}
                    min={MIN_SEAT_COUNT}
                    type="number"
                    value={seatCount}
                    onChange={updateSeatCount}
                  />
```

with:

```tsx
                  <output
                    aria-describedby="seat-count-help"
                    aria-live="polite"
                    className="seat-count-display"
                    id="seat-count"
                  >
                    {seatCount}
                  </output>
```

Keep the existing `<label htmlFor="seat-count">Number of seats</label>` and plus/minus buttons unchanged, including their disabled states and `onClick` handlers.

- [ ] **Step 3: Run the app tests to verify implementation passes**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS for all tests in `src/App.test.tsx`.

- [ ] **Step 4: Commit the implementation**

Run:

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: make seat stepper button only"
git push -u origin cursor/seat-stepper-buttons-1e2d
```

---

## Task 3: Style and Verify the Seat Count Display

**Files:**
- Modify: `src/styles.css`
- Test: `src/App.test.tsx`
- Test: full project checks

- [ ] **Step 1: Update seat picker styles for the output element**

In `src/styles.css`, replace:

```css
.seat-picker input {
  text-align: center;
}
```

with:

```css
.seat-count-display {
  align-items: center;
  background: #ffffff;
  border: 1px solid #d5dbea;
  border-radius: 12px;
  color: #172033;
  display: flex;
  font-weight: 800;
  justify-content: center;
  min-height: 46px;
  padding: 10px 12px;
  text-align: center;
}
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS for all tests in `src/App.test.tsx`.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
npm run lint
npm run build
npm test
```

Expected:
- `npm run lint` exits 0 with no ESLint errors.
- `npm run build` exits 0 after TypeScript and Vite build complete.
- `npm test` exits 0 with the full Vitest suite passing.

- [ ] **Step 4: Commit styling and verification-ready changes**

Run:

```bash
git add src/styles.css
git commit -m "style: update seat stepper display"
git push -u origin cursor/seat-stepper-buttons-1e2d
```

- [ ] **Step 5: Update the pull request**

Update the existing draft PR for `cursor/seat-stepper-buttons-1e2d` with a summary of the implementation commits and the exact verification commands that passed.

---

## Self-Review

- Spec coverage: Task 2 removes the editable input, renders the current count as non-editable text, preserves the label/helper/buttons, and keeps clamped plus/minus behavior. Task 1 covers button-only behavior and no editable spinbutton. Task 3 covers visual alignment and full verification.
- Placeholder scan: No placeholder steps are intentionally left for the implementer; each code change includes exact snippets and exact commands.
- Type consistency: The plan removes `ChangeEvent` when the typed-input handler is deleted, keeps `FormEvent`, and does not introduce new component types.
