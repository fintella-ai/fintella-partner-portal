/**
 * RFC 4180 CSV field escaping: wrap in double-quotes if the value contains
 * a comma, double-quote, or newline. Interior double-quotes are doubled.
 *
 * Isomorphic (no React/DOM deps) so both the admin export route and any other
 * server code can share one escaping implementation.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
