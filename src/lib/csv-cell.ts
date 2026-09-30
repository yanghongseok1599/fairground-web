/** CSV quoting protects structure; the apostrophe also keeps spreadsheet formulas inert. */
export function csvCell(value: string | number, alwaysQuote = false): string {
  const raw = String(value);
  const safe = /^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(raw) || /^[\t\r\n]/.test(raw) ? `'${raw}` : raw;
  return alwaysQuote || /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
