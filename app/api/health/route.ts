import { NextResponse } from "next/server";

// Liveness probe: no secrets, no personal data, no DB access.
// Use this for the Railway deployment health check.
export async function GET() {
  return NextResponse.json(
    { status: "ok", service: "say-yes-to-vegan-sugar", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
