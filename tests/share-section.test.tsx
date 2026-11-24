import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShareSection } from "../components/share-section";

describe("share section suggested message", () => {
  it("preserves the blank line before the URL while still wrapping long text", () => {
    render(<ShareSection />);
    const message = screen.getByText(/Temple Initiative/, { selector: "p" });
    // whitespace-pre-line keeps the blank line before the appended site URL;
    // break-words keeps long URLs wrapping safely on narrow screens.
    expect(message.className).toMatch(/whitespace-pre-line/);
    expect(message.className).toMatch(/break-words/);
    expect(message.textContent).toMatch(/share the message:\s+https?:/);
  });
});
