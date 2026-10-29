import type { WfhType, WeekDay } from "@/types";

export const WEEKDAY_LIST: WeekDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
export const WFH_TYPES: WfhType[] = ["rotating", "permanent_wfh", "permanent_wfo"];
export const LIMITS = { name: 50, designation: 60, email: 254 } as const;

type Field = "name" | "email" | "designation" | "wfhType" | "fixedDays" | "color";
export type FieldErrors = Partial<Record<Field, string>>;
export type EmployeeInput = { name?: unknown; email?: unknown; designation?: unknown; wfhType?: unknown; fixedDays?: unknown; color?: unknown };
export type EmployeeData = { name?: string; email?: string | null; designation?: string; wfhType?: WfhType; fixedDays?: WeekDay[]; color?: string | null };

/** `fixedDays` means fixed WFH days for permanent WFO, and fixed office days for everyone else. */
export const fixedDayKind = (type: WfhType): "wfh" | "office" => (type === "permanent_wfo" ? "wfh" : "office");

const NAME_RE = /^\p{L}[\p{L}\s.'-]*$/u, EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/**
 * Validates + normalizes employee fields. `partial` validates only provided fields (for updates);
 * `currentType` is the stored type, used when an update changes fixed days without sending the type.
 */
export function validateEmployee(input: EmployeeInput, { partial = false, currentType }: { partial?: boolean; currentType?: WfhType } = {}) {
  const errors: FieldErrors = {}, data: EmployeeData = {};
  const has = (k: keyof EmployeeInput) => !partial || input[k] !== undefined;

  if (has("name")) {
    const name = clean(input.name);
    if (!name) errors.name = "Name is required";
    else if (name.length < 2 || name.length > LIMITS.name) errors.name = `Name must be 2–${LIMITS.name} characters`;
    else if (!NAME_RE.test(name)) errors.name = "Use letters, spaces, dots, apostrophes or hyphens only";
    data.name = name;
  }
  if (has("designation")) {
    const designation = clean(input.designation);
    if (!designation) errors.designation = "Designation is required";
    else if (designation.length < 2 || designation.length > LIMITS.designation) errors.designation = `Designation must be 2–${LIMITS.designation} characters`;
    data.designation = designation;
  }
  if (input.email !== undefined) {
    const email = clean(input.email).toLowerCase();
    if (email && (email.length > LIMITS.email || !EMAIL_RE.test(email))) errors.email = "Enter a valid email address";
    data.email = email || null;
  }
  if (has("wfhType")) {
    const type = (input.wfhType ?? "rotating") as WfhType;
    if (!WFH_TYPES.includes(type)) errors.wfhType = "Pick a valid WFH type";
    else data.wfhType = type;
  }

  const type = data.wfhType ?? currentType ?? "rotating", kind = fixedDayKind(type);
  if (has("fixedDays")) {
    const raw = Array.isArray(input.fixedDays) ? input.fixedDays : [];
    const days = WEEKDAY_LIST.filter((d) => raw.includes(d));
    if (raw.some((d) => !WEEKDAY_LIST.includes(d as WeekDay))) errors.fixedDays = "Pick weekdays only";
    else if (days.length === WEEKDAY_LIST.length) errors.fixedDays = kind === "wfh" ? "Home all 5 days? Choose Permanent WFH instead" : "In office all 5 days? Choose Permanent WFO instead";
    data.fixedDays = days;
  } else if (currentType && fixedDayKind(currentType) !== kind) data.fixedDays = [];

  if (input.color !== undefined) {
    const color = clean(input.color);
    if (color && !HEX_RE.test(color)) errors.color = "Use a hex colour like #3B82F6";
    data.color = color || null;
  }
  return { errors, data, valid: Object.keys(errors).length === 0 };
}

export const firstError = (errors: FieldErrors) => Object.values(errors)[0] ?? "Invalid input";
