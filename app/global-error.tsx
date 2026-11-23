"use client";

// Global error boundary for the App Router root layout. Catches render errors
// that escape page-level handling and reports them to Sentry (sanitized by
// the shared beforeSend). Shows a generic message — never error details.

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem", fontFamily: "system-ui" }}>
          <h1>Something went wrong</h1>
          <p>Please try again. If the problem continues, contact us through the contact form.</p>
          <button
            onClick={() => reset()}
            style={{ marginTop: "1rem", padding: "0.6rem 1.5rem", borderRadius: 9999 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
