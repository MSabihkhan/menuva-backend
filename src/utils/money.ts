/**
 * Convert a rupee value (number, could be float) to paisa (integer).
 * Example: toPaisa(149.99) => 14999
 */
export function toPaisa(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert paisa (integer) to rupee value for display.
 * Example: fromPaisa(14999) => 149.99
 */
export function fromPaisa(paisa: number): number {
  return paisa / 100;
}

/**
 * Apply basis points to a paisa amount.
 * bps = 1600 means 16%. Result is rounded to nearest integer paisa.
 * Example: applyBps(10000, 1600) => 1600 (16% of 100.00)
 */
export function applyBps(amountPaisa: number, bps: number): number {
  return Math.round((amountPaisa * bps) / 10000);
}
