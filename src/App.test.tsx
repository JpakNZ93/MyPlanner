import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the event registration heading and seat price", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: /event registration/i })).toBeInTheDocument();
    expect(screen.getByText(/aud \$50 per seat/i)).toBeInTheDocument();
  });
});
