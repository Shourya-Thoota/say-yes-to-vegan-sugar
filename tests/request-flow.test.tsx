/**
 * jsdom integration test for the critical donation-request flow.
 * (Playwright browser tests in tests/e2e/ could not run in this sandbox
 * because the Chromium download stalls; this exercises the same flow logic.)
 */
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RequestForm } from "../app/request-sugar/request-form";

beforeEach(() => {
  vi.restoreAllMocks();
  // jsdom does not implement scrollTo; the form calls it on success.
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

function fillStep0() {
  fireEvent.change(screen.getByLabelText(/Temple name/i), { target: { value: "Sri Test Temple" } });
  fireEvent.change(screen.getByLabelText(/Street address/i), { target: { value: "123 Temple Rd" } });
  fireEvent.change(screen.getByLabelText(/^City/i), { target: { value: "Houston" } });
  fireEvent.change(screen.getByLabelText(/State/i), { target: { value: "TX" } });
  fireEvent.change(screen.getByLabelText(/ZIP code/i), { target: { value: "77001" } });
}

function fillStep1() {
  fireEvent.change(screen.getByLabelText(/Full name/i), { target: { value: "Jane Doe" } });
  fireEvent.change(screen.getByLabelText(/Role at temple/i), { target: { value: "Trustee" } });
  fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "jane@example.org" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /authorized to submit/i }));
}

function fillStep2() {
  fireEvent.change(screen.getByLabelText(/Requested quantity/i), { target: { value: "50" } });
  fireEvent.click(screen.getByText("Prasadam"));
}

function fillStep3() {
  fireEvent.click(screen.getByRole("checkbox", { name: /does not guarantee approval/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /consent to being contacted/i }));
}

describe("donation request critical flow", () => {
  it("blocks empty submission, preserves typed values, and succeeds end to end", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, ref: "SVS-TEST-1234" }), { status: 201 })));
    render(<RequestForm disabled={false} />);

    // Empty continue -> validation summary, nothing submitted.
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByText(/please correct/i)).toBeTruthy();
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // Type a value, fail again, value must be preserved.
    fireEvent.change(screen.getByLabelText(/Temple name/i), { target: { value: "Sri Test Temple" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(screen.getByText(/please correct/i)).toBeTruthy();
    });
    expect((screen.getByLabelText(/Temple name/i) as HTMLInputElement).value).toBe("Sri Test Temple");

    // Complete all steps.
    fillStep0();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText(/Contact person/i)).toBeTruthy());

    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText(/Temple needs/i)).toBeTruthy());

    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText(/Review your request/i)).toBeTruthy());

    fillStep3();
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    await waitFor(() => {
      expect(screen.getByText(/Your request has been received/i)).toBeTruthy();
    });
    expect(screen.getByTestId("request-reference").textContent).toBe("SVS-TEST-1234");
  });

  it("shows an honest error and preserves values when persistence fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, errors: { _form: "We could not save your request." } }), { status: 500 })));
    render(<RequestForm disabled={false} />);

    fillStep0();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText(/Contact person/i)).toBeTruthy());
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText(/Temple needs/i)).toBeTruthy());
    fillStep2();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByText(/Review your request/i)).toBeTruthy());
    fillStep3();
    fireEvent.click(screen.getByRole("button", { name: "Submit Request" }));

    await waitFor(() => {
      expect(screen.getByText(/We could not save your request/i)).toBeTruthy();
    });
    // No success message shown.
    expect(screen.queryByText(/Your request has been received/i)).toBeNull();
  });
});
