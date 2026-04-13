const PKR_LOCALE = "en-PK";

// Number grouping for PKR using en-PK locale
export function formatPKR(
  value: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const min = options?.minimumFractionDigits ?? 0;
  const max = options?.maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(PKR_LOCALE, {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(value);
}

export function formatPKRWithSymbol(
  value: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  return `Rs. ${formatPKR(value, options)}`;
}

export function formatCompactPKR(value: number): string {
  return new Intl.NumberFormat(PKR_LOCALE, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}
