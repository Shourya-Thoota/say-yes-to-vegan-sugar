import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SugarChecker } from "../app/choosing-sugar/sugar-checker";
import { getCheckerResult, getCategoryIds } from "../lib/sugar-checker";

describe("sugar checker categories", () => {
  it("offers six categories including unknown", () => {
    expect(getCategoryIds()).toEqual([
      "organic-cane",
      "beet",
      "turbinado-raw",
      "conventional-refined",
      "jaggery",
      "unknown-mixed",
    ]);
  });

  it("never uses definitive certification wording", () => {
    for (const id of getCategoryIds()) {
      const r = getCheckerResult(id);
      const blob = `${r.heading} ${r.explanation} ${r.verify.join(" ")} ${r.limitation}`;
      expect(blob).not.toMatch(/verified vegan/i);
      expect(blob).not.toMatch(/\bsafe\b/i);
      expect(blob).not.toMatch(/definitely vegan/i);
      expect(blob).not.toMatch(/certified vegan product/i);
      expect(r.verify.length).toBeGreaterThanOrEqual(2);
      expect(r.sources.length).toBeGreaterThanOrEqual(1);
      for (const s of r.sources) {
        expect(s.href).toMatch(/^https:\/\//);
      }
    }
  });

  it("unknown category gives a confirm-with-manufacturer outcome", () => {
    const r = getCheckerResult("unknown-mixed");
    const blob = `${r.heading} ${r.explanation} ${r.limitation}`.toLowerCase();
    expect(blob).toMatch(/confirm with the manufacturer|not enough information/);
  });
});

describe("sugar checker interaction", () => {
  it("shows guidance after choosing a category and supports back/reset", () => {
    render(<SugarChecker />);
    expect(screen.getByText(/select a category above/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/Conventional refined white cane sugar/i));
    expect(screen.getByText(/manufacturer check matters most/i)).toBeTruthy();
    expect(screen.getByText(/what to look for on this product/i)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /domino|vegan action|epa/i }).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /draft an inquiry/i }));
    expect(screen.getByText(/jump to the inquiry builder/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /back to categories/i }));
    // Result hidden again; prompt returns.
    expect(screen.getByText(/select a category above/i)).toBeTruthy();
  });

  it("start over clears the selection", () => {
    render(<SugarChecker />);
    fireEvent.click(screen.getByLabelText(/Jaggery/i));
    expect(screen.getByText(/check this maker's processing information/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(screen.getByText(/select a category above/i)).toBeTruthy();
    expect(screen.queryByText(/check this maker's processing information/i)).toBeNull();
  });

  it("exposes an aria-live result region without moving focus", () => {
    render(<SugarChecker />);
    fireEvent.click(screen.getByLabelText(/Beet sugar/i));
    const live = document.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.textContent).toMatch(/confirm the source/i);
    // No disruptive focus jump: focus must not be forced inside the result region.
    expect(live?.contains(document.activeElement)).toBe(false);
  });

  it("turbinado result keeps the claim product-specific with sources", () => {
    render(<SugarChecker />);
    fireEvent.click(screen.getByLabelText(/Turbinado/i));
    expect(screen.getByText(/does not cover all/i)).toBeTruthy();
    expect(screen.getByText(/do not extend one turbinado/i, { exact: false })).toBeTruthy();
  });
});
