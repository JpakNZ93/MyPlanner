import { useState, type ChangeEvent, type FormEvent } from "react";
import {
  DISPLAY_CURRENCY,
  MAX_SEAT_COUNT,
  PRICE_PER_SEAT_CENTS,
  calculateTotalAmount,
  normalizeRegistration,
} from "./lib/registration";

interface EventConfig {
  title: string;
  subtitle: string;
  date: string;
  venue: string;
  backgroundImageUrl: string;
}

interface PrimaryAttendeeForm {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  church: string;
}

interface AdditionalAttendeeForm {
  id: number;
  firstName: string;
  lastName: string;
  church: string;
  mobile: string;
  email: string;
  usesPrimaryContact: boolean;
}

type PrimaryAttendeeField = keyof PrimaryAttendeeForm;
type AdditionalAttendeeField = keyof Pick<
  AdditionalAttendeeForm,
  "firstName" | "lastName" | "church" | "mobile" | "email" | "usesPrimaryContact"
>;

const eventConfig: EventConfig = {
  title: import.meta.env.VITE_PUBLIC_EVENT_TITLE || "Event Registration",
  subtitle: import.meta.env.VITE_PUBLIC_EVENT_SUBTITLE || "Register your seat",
  date: import.meta.env.VITE_PUBLIC_EVENT_DATE || "Event date",
  venue: import.meta.env.VITE_PUBLIC_EVENT_VENUE || "Event venue",
  backgroundImageUrl: import.meta.env.VITE_PUBLIC_BACKGROUND_IMAGE_URL || "",
};

const emptyPrimaryAttendee: PrimaryAttendeeForm = {
  firstName: "",
  lastName: "",
  mobile: "",
  email: "",
  church: "",
};

const MIN_SEAT_COUNT = 1;

const clampSeatCount = (value: number) =>
  Math.min(MAX_SEAT_COUNT, Math.max(MIN_SEAT_COUNT, value));

const formatCurrency = (cents: number) => `${DISPLAY_CURRENCY} $${(cents / 100).toFixed(2)}`;

export function App() {
  const pathName = window.location.pathname;

  if (pathName === "/success") {
    return <SuccessPage />;
  }

  if (pathName === "/cancel") {
    return <CancelPage />;
  }

  return <RegistrationPage />;
}

function SuccessPage() {
  return (
    <main className="page-shell">
      <section className="registration-card" aria-labelledby="success-title">
        <p className="eyebrow">Stripe payment complete</p>
        <h1 id="success-title">Payment received</h1>
        <p>Thank you. Your registration payment was received, and your registration is being processed.</p>
      </section>
    </main>
  );
}

function CancelPage() {
  return (
    <main className="page-shell">
      <section className="registration-card" aria-labelledby="cancel-title">
        <p className="eyebrow">Checkout cancelled</p>
        <h1 id="cancel-title">Payment cancelled</h1>
        <p>Your payment was not completed. Return to the registration page when you are ready to try again.</p>
        <a className="link-button" href="/">
          Return to registration
        </a>
      </section>
    </main>
  );
}

function RegistrationPage() {
  const [seatCount, setSeatCount] = useState(1);
  const [primaryAttendee, setPrimaryAttendee] = useState<PrimaryAttendeeForm>(emptyPrimaryAttendee);
  const [additionalAttendees, setAdditionalAttendees] = useState<AdditionalAttendeeForm[]>([]);
  const [nextAttendeeId, setNextAttendeeId] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const seatPrice = `${DISPLAY_CURRENCY} $${PRICE_PER_SEAT_CENTS / 100} per seat`;
  const totalAmount = formatCurrency(calculateTotalAmount(seatCount));

  const updatePrimaryAttendee = (field: PrimaryAttendeeField, value: string) => {
    setPrimaryAttendee((current) => ({ ...current, [field]: value }));
  };

  const updateAdditionalAttendee = (
    id: number,
    field: AdditionalAttendeeField,
    value: string | boolean,
  ) => {
    setAdditionalAttendees((current) =>
      current.map((attendee) =>
        attendee.id === id ? { ...attendee, [field]: value } : attendee,
      ),
    );
  };

  const addAdditionalAttendee = () => {
    if (additionalAttendees.length >= MAX_SEAT_COUNT - 1) {
      return;
    }

    setAdditionalAttendees((current) => [
      ...current,
      {
        id: nextAttendeeId,
        firstName: "",
        lastName: "",
        church: "",
        mobile: "",
        email: "",
        usesPrimaryContact: false,
      },
    ]);
    setNextAttendeeId((current) => current + 1);
    setSeatCount((current) => clampSeatCount(Math.max(current + 1, additionalAttendees.length + 2)));
  };

  const removeAdditionalAttendee = (id: number) => {
    setAdditionalAttendees((current) => current.filter((attendee) => attendee.id !== id));
    setSeatCount((current) => clampSeatCount(current - 1));
  };

  const updateSeatCount = (event: ChangeEvent<HTMLInputElement>) => {
    setSeatCount(clampSeatCount(Number(event.target.value)));
  };

  const adjustSeatCount = (amount: number) => {
    setSeatCount((current) => clampSeatCount(current + amount));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");

    let registration;
    try {
      registration = normalizeRegistration({
        seatCount,
        primaryAttendee,
        additionalAttendees,
      });
    } catch {
      setErrorMessage("Please complete the required fields before checkout.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registration),
      });

      if (!response.ok) {
        throw new Error("Checkout request failed");
      }

      const { checkoutUrl } = (await response.json()) as { checkoutUrl?: string };
      if (!checkoutUrl) {
        throw new Error("Checkout URL missing");
      }

      window.location.assign(checkoutUrl);
    } catch {
      setErrorMessage("Checkout could not start. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main
      className="page-shell"
      style={
        eventConfig.backgroundImageUrl
          ? { backgroundImage: `linear-gradient(rgba(10, 19, 38, 0.5), rgba(10, 19, 38, 0.5)), url(${eventConfig.backgroundImageUrl})` }
          : undefined
      }
    >
      <section className="registration-card" aria-labelledby="page-title">
        <div className="event-summary">
          <p className="eyebrow">{seatPrice}</p>
          <h1 id="page-title">{eventConfig.title}</h1>
          <p className="subtitle">{eventConfig.subtitle}</p>
          <dl className="event-meta">
            <div>
              <dt>Date</dt>
              <dd>{eventConfig.date}</dd>
            </div>
            <div>
              <dt>Venue</dt>
              <dd>{eventConfig.venue}</dd>
            </div>
          </dl>
        </div>

        <form className="registration-form" noValidate onSubmit={handleSubmit}>
          {errorMessage ? (
            <p className="alert" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <fieldset>
            <legend>Primary attendee</legend>
            <div className="form-grid">
              <label>
                First name
                <input
                  autoComplete="given-name"
                  value={primaryAttendee.firstName}
                  onChange={(event) => updatePrimaryAttendee("firstName", event.target.value)}
                />
              </label>
              <label>
                Last name
                <input
                  autoComplete="family-name"
                  value={primaryAttendee.lastName}
                  onChange={(event) => updatePrimaryAttendee("lastName", event.target.value)}
                />
              </label>
              <label>
                Mobile number
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  value={primaryAttendee.mobile}
                  onChange={(event) => updatePrimaryAttendee("mobile", event.target.value)}
                />
              </label>
              <label>
                Email address
                <input
                  autoComplete="email"
                  inputMode="email"
                  type="email"
                  value={primaryAttendee.email}
                  onChange={(event) => updatePrimaryAttendee("email", event.target.value)}
                />
              </label>
              <label className="full-width">
                Church
                <input
                  value={primaryAttendee.church}
                  onChange={(event) => updatePrimaryAttendee("church", event.target.value)}
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Seats</legend>
            <div className="seat-row">
              <div className="seat-control">
                <label htmlFor="seat-count">Number of seats</label>
                <div className="seat-picker">
                  <button
                    aria-label="Decrease seats"
                    className="seat-picker-button"
                    disabled={seatCount <= MIN_SEAT_COUNT}
                    type="button"
                    onClick={() => adjustSeatCount(-1)}
                  >
                    -
                  </button>
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
                  <button
                    aria-label="Increase seats"
                    className="seat-picker-button"
                    disabled={seatCount >= MAX_SEAT_COUNT}
                    type="button"
                    onClick={() => adjustSeatCount(1)}
                  >
                    +
                  </button>
                </div>
                <span className="field-help" id="seat-count-help">
                  Choose 1 to {MAX_SEAT_COUNT} seats.
                </span>
              </div>
              <p className="total">Total: {totalAmount}</p>
            </div>
          </fieldset>

          <fieldset>
            <legend>Additional attendees</legend>
            <div className="fieldset-heading">
              <p>Add guest details now or leave them blank and provide them later.</p>
              <button
                className="secondary-button"
                disabled={additionalAttendees.length >= MAX_SEAT_COUNT - 1}
                type="button"
                onClick={addAdditionalAttendee}
              >
                Add another attendee
              </button>
            </div>

            {additionalAttendees.map((attendee, index) => {
              const attendeeNumber = index + 1;

              return (
                <div className="attendee-panel" key={attendee.id}>
                  <div className="attendee-panel-header">
                    <h3>Additional attendee {attendeeNumber}</h3>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => removeAdditionalAttendee(attendee.id)}
                    >
                      Remove attendee {attendeeNumber}
                    </button>
                  </div>
                  <div className="form-grid">
                    <label>
                      Additional attendee {attendeeNumber} first name
                      <input
                        value={attendee.firstName}
                        onChange={(event) =>
                          updateAdditionalAttendee(attendee.id, "firstName", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Additional attendee {attendeeNumber} last name
                      <input
                        value={attendee.lastName}
                        onChange={(event) =>
                          updateAdditionalAttendee(attendee.id, "lastName", event.target.value)
                        }
                      />
                    </label>
                    <label className="full-width">
                      Additional attendee {attendeeNumber} church
                      <input
                        value={attendee.church}
                        onChange={(event) =>
                          updateAdditionalAttendee(attendee.id, "church", event.target.value)
                        }
                      />
                    </label>
                    {!attendee.usesPrimaryContact ? (
                      <>
                        <label>
                          Additional attendee {attendeeNumber} mobile number
                          <input
                            autoComplete="tel"
                            inputMode="tel"
                            value={attendee.mobile}
                            onChange={(event) =>
                              updateAdditionalAttendee(attendee.id, "mobile", event.target.value)
                            }
                          />
                        </label>
                        <label>
                          Additional attendee {attendeeNumber} email address
                          <input
                            autoComplete="email"
                            inputMode="email"
                            type="email"
                            value={attendee.email}
                            onChange={(event) =>
                              updateAdditionalAttendee(attendee.id, "email", event.target.value)
                            }
                          />
                        </label>
                      </>
                    ) : null}
                    <label className="checkbox-row full-width">
                      <input
                        checked={attendee.usesPrimaryContact}
                        type="checkbox"
                        onChange={(event) =>
                          updateAdditionalAttendee(
                            attendee.id,
                            "usesPrimaryContact",
                            event.target.checked,
                          )
                        }
                      />
                      Use same contact details
                    </label>
                  </div>
                </div>
              );
            })}
          </fieldset>

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Starting checkout..." : "Pay with Stripe"}
          </button>
        </form>
      </section>
    </main>
  );
}
