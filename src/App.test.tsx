import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign: vi.fn(), pathname: "/" },
  });
});

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("adds and removes additional attendees", async () => {
    const user = userEvent.setup();
    render(<App />);

    const seatCountInput = screen.getByLabelText(/number of seats/i);
    await user.click(screen.getByRole("button", { name: /add another attendee/i }));
    expect(seatCountInput).toHaveValue(2);
    expect(screen.getByLabelText(/additional attendee 1 first name/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove attendee 1/i }));
    expect(seatCountInput).toHaveValue(1);
    expect(screen.queryByLabelText(/additional attendee 1 first name/i)).not.toBeInTheDocument();
  });

  it("increments the seat count when adding another attendee", async () => {
    const user = userEvent.setup();
    render(<App />);

    const seatCountInput = screen.getByLabelText(/number of seats/i);
    fireEvent.change(seatCountInput, { target: { value: "3" } });
    await user.click(screen.getByRole("button", { name: /add another attendee/i }));

    expect(seatCountInput).toHaveValue(4);
  });

  it("submits valid registration details and redirects to Stripe Checkout", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ checkoutUrl: "https://checkout.stripe.test/session" }),
    });

    render(<App />);

    await user.type(screen.getByLabelText(/first name/i), "Jane");
    await user.type(screen.getByLabelText(/last name/i), "Citizen");
    await user.type(screen.getByLabelText(/mobile number/i), "0412345678");
    await user.type(screen.getByLabelText(/email address/i), "jane@example.com");
    await user.type(screen.getByLabelText(/^church/i), "Central Church");
    await user.click(screen.getByRole("button", { name: /pay with stripe/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/create-checkout-session",
        expect.objectContaining({ method: "POST" }),
      );
      expect(window.location.assign).toHaveBeenCalledWith("https://checkout.stripe.test/session");
    });
  });

  it("shows validation feedback before checkout", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /pay with stripe/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/complete the required fields/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
