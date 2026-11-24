import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InquiryBuilder } from "../app/choosing-sugar/inquiry-builder";

const GUIDE = "https://say-yes-to-vegan-sugar-production.up.railway.app/choosing-sugar";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("inquiry builder", () => {
  it("previews a generic draft and exposes an encoded email link", () => {
    render(<InquiryBuilder guideUrl={GUIDE} />);
    expect(screen.getByText(/bone char/i)).toBeTruthy();
    const mailto = screen.getByRole("link", { name: /open email draft/i }).getAttribute("href") ?? "";
    expect(mailto.startsWith("mailto:?")).toBe(true);
    expect(screen.getByText(/does not send anything/i)).toBeTruthy();
  });

  it("reflects typed fields in the preview as text", () => {
    render(<InquiryBuilder guideUrl={GUIDE} />);
    fireEvent.change(screen.getByLabelText(/exact product name/i), { target: { value: "Temple <Special> Sugar" } });
    const preview = screen.getByLabelText(/inquiry draft preview/i);
    expect(preview.textContent).toContain("Temple <Special> Sugar");
    expect(preview.querySelector("script")).toBeNull();
  });

  it("announces copy success", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true, writable: true });
    try {
      render(<InquiryBuilder guideUrl={GUIDE} />);
      fireEvent.click(screen.getByRole("button", { name: /copy inquiry/i }));
      await waitFor(() => {
        expect(screen.getByText(/paste it into your message to the manufacturer/i)).toBeTruthy();
      });
      expect(writeText).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true, writable: true });
    }
  });

  it("shows a manual-copy fallback when clipboard fails", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true, writable: true });
    render(<InquiryBuilder guideUrl={GUIDE} />);
    fireEvent.click(screen.getByRole("button", { name: /copy inquiry/i }));
    await waitFor(() => {
      expect(screen.getByText(/select the preview above and copy it manually/i)).toBeTruthy();
    });
  });
});
