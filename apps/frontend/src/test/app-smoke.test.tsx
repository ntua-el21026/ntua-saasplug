import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "../App";

describe("App", () => {
  it("renders the login route with EV product copy", async () => {
    window.history.pushState({}, "", "/login");

    render(<App />);

    expect(await screen.findByRole("heading", { name: /find and reserve ev charging points/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /google oauth/i })).toBeInTheDocument();
  });
});
