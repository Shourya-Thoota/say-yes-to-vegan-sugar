// CSV escaping + spreadsheet formula-injection protection.

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Prevent formula injection: prefix cells starting with = + - @ tab/CR (and | %) with a single quote.
  if (/^[=+\-@\t\r|%].*/.test(s)) s = "'" + s;
  const needsQuotes = /[",\n\r]/.test(s) || s.startsWith("'") || s !== s.trim();
  if (needsQuotes) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(headers: string[], rows: (unknown[] | Record<string, unknown>)[]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    const values = Array.isArray(row) ? row : headers.map((h) => (row as Record<string, unknown>)[h]);
    lines.push(values.map(csvCell).join(","));
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  needs_information: "Needs Information",
  approved: "Approved",
  ordered: "Ordered",
  delivered: "Delivered",
  declined: "Declined",
  withdrawn: "Withdrawn",
};
