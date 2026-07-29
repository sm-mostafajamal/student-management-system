/**
 * Prisma's Decimal type is not JSON-serializable.
 * Passing a raw Prisma query result across the Server → Client boundary
 * (RSC serialization) or through JSON.stringify in an API route will either
 * throw or silently produce "[object Object]".
 *
 * These helpers live in lib/ (not services/) because every service uses them —
 * co-locating in a single service would force cross-service imports.
 */

import { Prisma } from "@prisma/client";

/**
 * Converts a Prisma Decimal to a JavaScript number.
 * Use for monetary values where 2 decimal places is sufficient
 * and full precision is not required at the JS layer.
 */
export function toNumber(d: Prisma.Decimal | null | undefined): number | null {
  if (d == null) return null;
  return d.toNumber();
}

/**
 * Non-null variant — throws if the value is null.
 * Use when the DB column is NOT NULL and the service guarantees presence.
 */
export function toNumberRequired(d: Prisma.Decimal): number {
  return d.toNumber();
}

/**
 * Serializes a Decimal to a fixed-2-decimal string for display.
 * Useful for currency rendering where "10.00" is preferred over "10".
 */
export function toCurrencyString(
  d: Prisma.Decimal | null | undefined
): string {
  if (d == null) return "0.00";
  return d.toFixed(2);
}

/**
 * Converts a plain number back to Prisma.Decimal for writes.
 * Used when a service receives a validated number from a form/API payload
 * and needs to pass it to Prisma.
 */
export function fromNumber(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}