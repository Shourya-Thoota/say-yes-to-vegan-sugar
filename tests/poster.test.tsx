import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  POSTER_CAUTION,
  POSTER_STEPS,
  getChoosingSugarUrl,
  getPosterUrl,
  getSiteBaseUrl,
  normalizeBaseUrl,
} from "../lib/poster";
import { PrintButton } from "../app/poster/print-button";

describe("poster URL construction", () => {
  it("strips a trailing slash and appends the choosing-sugar path", () => {
    expect(getChoosingSugarUrl({ NEXT_PUBLIC_SITE_URL: "https://example.org/" } as never)).toBe(
      "https://example.org/choosing-sugar"
    );
    expect(getPosterUrl({ NEXT_PUBLIC_SITE_URL: "https://example.org" } as never)).toBe(
      "https://example.org/poster"
    );
  });

  it("never prints localhost when a production URL is configured", () => {
    const base = getSiteBaseUrl({
      NEXT_PUBLIC_SITE_URL: "https://say-yes-to-vegan-sugar-production.up.railway.app",
    } as never);
    expect(base).not.toContain("localhost");
    expect(normalizeBaseUrl("https://example.org/")).toBe("https://example.org");
  });

  it("poster content keeps cautious, generic language", () => {
    expect(POSTER_STEPS).toHaveLength(3);
    expect(POSTER_STEPS[0].title).toMatch(/exact product/i);
    expect(POSTER_STEPS[1].title).toMatch(/product-specific/i);
    expect(POSTER_STEPS[2].title).toMatch(/record/i);
    expect(POSTER_CAUTION).toMatch(/varies by product and manufacturer/i);
    expect(POSTER_CAUTION).not.toMatch(/every.*sugar.*bone char/i);
    expect(JSON.stringify(POSTER_STEPS)).not.toMatch(/certified|approved brand/i);
  });
});

describe("poster print button", () => {
  it("opens the browser print dialog and explains it", () => {
    const spy = vi.fn();
    Object.defineProperty(window, "print", { value: spy, writable: true, configurable: true });
    render(<PrintButton />);
    expect(
      screen.getByText(/opens your browser's print dialog/i)
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /print \/ save as pdf/i }));
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("poster guide links", () => {
  it("homepage and choosing-sugar guide reference /poster", async () => {
    const fs = await import("node:fs");
    const home = fs.readFileSync("app/page.tsx", "utf8");
    const guide = fs.readFileSync("app/choosing-sugar/page.tsx", "utf8");
    expect(home).toContain('href="/poster"');
    expect(home).toContain("Print the one-page kitchen guide");
    expect(guide).toContain('href="/poster"');
    expect(guide).toContain("printable kitchen guide");
  });

  it("homepage keeps the verified video and does not add sponsorship actions", async () => {
    const fs = await import("node:fs");
    const home = fs.readFileSync("app/page.tsx", "utf8");
    expect(home).toContain("tOw5M40uSyk");
    expect(home).toContain("https://www.youtube.com/watch?v=tOw5M40uSyk");
    expect(home).not.toMatch(/Sponsor a Bag|Sponsor-A-Bag|funding progress/i);
  });
});
