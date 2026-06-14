import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  it("renders the success page when Stripe redirects after payment", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: vi.fn(), pathname: "/success" },
    });

    render(<App />);

    expect(screen.getByRole("heading", { name: /payment received/i })).toBeInTheDocument();
  });

  it("renders the cancel page when payment is cancelled", () => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: vi.fn(), pathname: "/cancel" },
    });

    render(<App />);

    expect(screen.getByRole("heading", { name: /payment cancelled/i })).toBeInTheDocument();
  });

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
    expect(screen.queryByRole("textbox", { name: /number of seats/i })).not.toBeInTheDocument();
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

  it("submits distinct optional contact details for an additional attendee", async () => {
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
    await user.click(screen.getByRole("button", { name: /add another attendee/i }));
    await user.type(screen.getByLabelText(/additional attendee 1 first name/i), "John");
    await user.type(screen.getByLabelText(/additional attendee 1 last name/i), "Citizen");
    await user.type(screen.getByLabelText(/additional attendee 1 church/i), "North Church");
    await user.type(screen.getByLabelText(/additional attendee 1 mobile number/i), "0499999999");
    await user.type(screen.getByLabelText(/additional attendee 1 email address/i), "john@example.com");
    await user.click(screen.getByRole("button", { name: /pay with stripe/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(request.body as string);
    expect(payload.additionalAttendees[0]).toEqual({
      firstName: "John",
      lastName: "Citizen",
      church: "North Church",
      mobile: "0499999999",
      email: "john@example.com",
      usesPrimaryContact: false,
    });
  });

  it("submits primary contact details for an additional attendee using same contact details", async () => {
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
    await user.click(screen.getByRole("button", { name: /add another attendee/i }));
    await user.type(screen.getByLabelText(/additional attendee 1 first name/i), "John");
    await user.type(screen.getByLabelText(/additional attendee 1 last name/i), "Citizen");
    await user.type(screen.getByLabelText(/additional attendee 1 church/i), "North Church");
    await user.click(screen.getByLabelText(/use same contact details/i));
    expect(screen.queryByLabelText(/additional attendee 1 mobile number/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/additional attendee 1 email address/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /pay with stripe/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(request.body as string);
    expect(payload.additionalAttendees[0]).toEqual({
      firstName: "John",
      lastName: "Citizen",
      church: "North Church",
      mobile: "0412345678",
      email: "jane@example.com",
      usesPrimaryContact: true,
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
