import {
  CATEGORY_KINDS,
  DURATIONS,
  STAGE_KINDS,
  type CategoryKind,
  type Duration,
  type Priority,
  type StageKind,
} from "./types";

/**
 * Hand-rolled because the payloads are small and the app ships no validation
 * dependency. Every helper returns a value or throws `Invalid`, which route
 * handlers turn into a specific 400.
 */
export class Invalid extends Error {}

export function fail(message: string): never {
  throw new Invalid(message);
}

export function body(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("Expected an object");
  return value as Record<string, unknown>;
}

export function str(value: unknown, field: string, max = 10_000): string {
  if (typeof value !== "string") fail(`${field} must be text`);
  return value.slice(0, max);
}

export function nonEmpty(value: unknown, field: string, max = 500): string {
  const s = str(value, field, max).trim();
  if (!s) fail(`${field} can't be empty`);
  return s;
}

export function optionalStr(value: unknown, field: string, max = 10_000): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return str(value, field, max);
}

export function uuid(value: unknown, field: string): string {
  const s = str(value, field, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    fail(`${field} isn't a valid id`);
  }
  return s;
}

export function optionalUuid(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return uuid(value, field);
}

export function uuidList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  return value.map((v) => uuid(v, field));
}

/** Local YYYY-MM-DD, validated as a real calendar date rather than a shape. */
export function isoDate(value: unknown, field: string): string {
  const s = str(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail(`${field} must look like YYYY-MM-DD`);
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    fail(`${field} isn't a real date`);
  }
  return s;
}

export function isoTimestamp(value: unknown, field: string): string {
  const s = str(value, field, 40);
  const t = Date.parse(s);
  if (Number.isNaN(t)) fail(`${field} isn't a valid time`);
  return new Date(t).toISOString();
}

export function optionalTime(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const s = str(value, field, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) fail(`${field} must look like HH:MM`);
  return s;
}

/** Any whole number of minutes — estimates are not capped, see DURATIONS. */
export function duration(value: unknown, field: string): Duration {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) fail(`${field} must be a whole number of minutes, at least 1`);
  return n;
}

export function priority(value: unknown, field: string): Priority {
  const n = Number(value);
  if (![0, 1, 2, 3].includes(n)) fail(`${field} must be 0-3`);
  return n as Priority;
}

export function stageKind(value: unknown, field: string): StageKind {
  const s = str(value, field, 20);
  if (!STAGE_KINDS.includes(s as StageKind)) fail(`${field} must be one of ${STAGE_KINDS.join(", ")}`);
  return s as StageKind;
}

export function minutes(value: unknown, field: string, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > max) {
    fail(
      max === Number.MAX_SAFE_INTEGER
        ? `${field} must be a whole number, at least 1`
        : `${field} must be 1-${max}`,
    );
  }
  return n;
}

export function index(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) fail(`${field} must be a position`);
  return n;
}

export function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fail(`${field} must be true or false`);
  return value;
}

export function tags(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  return value.map((v) => nonEmpty(v, field, 60).toLowerCase()).slice(0, 25);
}

export function categoryKind(value: unknown, field: string): CategoryKind {
  const s = str(value, field, 20);
  if (!CATEGORY_KINDS.includes(s as CategoryKind)) {
    fail(`${field} must be one of ${CATEGORY_KINDS.join(", ")}`);
  }
  return s as CategoryKind;
}

export function hour(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 23) fail(`${field} must be an hour, 0-23`);
  return n;
}

export function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) fail(`${field} must be a list`);
  return value.map((v) => str(v, field, 40));
}
