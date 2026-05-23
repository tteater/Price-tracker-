export function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function truncateText(text: string | null | undefined, maxLength = 40): string {
  if (!text) return 'Unnamed Product';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

export function formatDropPercent(value: number): string {
  return value.toFixed(2);
}
