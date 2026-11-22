import { NextResponse } from "next/server";
import { checkDbReadable, isDbConfigured } from "@/lib/db";

// Readiness probe: verifies database connectivity. Returns 503 when unavailable.
// Do not expose detailed DB errors publicly.
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ status: "not_ready", reason: "database_not_configured" }, { status: 503 });
  }
  const { ok } = await checkDbReadable();
  if (!ok) {
    return NextResponse.json({ status: "not_ready", reason: "database_unreachable" }, { status: 503 });
  }
  return NextResponse.json({ status: "ready", time: new Date().toISOString() });
}
