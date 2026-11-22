import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { contactInquiries, donationRequests, supportOffers } from "@/lib/schema";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "requests";

  if (type === "requests") {
    const rows = await db.select().from(donationRequests).orderBy(desc(donationRequests.createdAt)).limit(5000);
    const headers = ["public_ref","temple_name","city","state","zip","contact_name","contact_role","contact_email","contact_phone","quantity_pounds","date_needed","intended_use","status","created_at"];
    const data = rows.map((r) => ({
      public_ref: r.publicRef, temple_name: r.templeName, city: r.city, state: r.state, zip: r.zipCode,
      contact_name: r.contactName, contact_role: r.contactRole, contact_email: r.contactEmail, contact_phone: r.contactPhone ?? "",
      quantity_pounds: r.quantityPounds, date_needed: r.dateNeeded ?? "", intended_use: (r.intendedUse as string[]).join("; "),
      status: r.status, created_at: new Date(r.createdAt).toISOString(),
    }));
    return csvResponse(toCsv(headers, data), "donation-requests.csv");
  }
  if (type === "support") {
    const rows = await db.select().from(supportOffers).orderBy(desc(supportOffers.createdAt)).limit(5000);
    const headers = ["public_ref","name","email","organization","support_type","message","created_at"];
    const data = rows.map((r) => ({ public_ref: r.publicRef, name: r.name, email: r.email, organization: r.organization ?? "", support_type: r.supportType, message: r.message, created_at: new Date(r.createdAt).toISOString() }));
    return csvResponse(toCsv(headers, data), "support-offers.csv");
  }
  const rows = await db.select().from(contactInquiries).orderBy(desc(contactInquiries.createdAt)).limit(5000);
  const headers = ["public_ref","name","email","subject","message","created_at"];
  const data = rows.map((r) => ({ public_ref: r.publicRef, name: r.name, email: r.email, subject: r.subject, message: r.message, created_at: new Date(r.createdAt).toISOString() }));
  return csvResponse(toCsv(headers, data), "contact-inquiries.csv");
}

function csvResponse(body: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
