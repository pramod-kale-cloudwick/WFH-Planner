import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { addDays, format, parseISO, startOfWeek } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Work week (Mon–Fri) for a stored Sunday-based week start; number = nth Monday of that month. */
export function workWeek(weekStart: Date | string) {
  const monday = addDays(startOfWeek(typeof weekStart === "string" ? parseISO(weekStart) : weekStart, { weekStartsOn: 0 }), 1), friday = addDays(monday, 4);
  const number = Math.ceil(monday.getDate() / 7), range = `${format(monday, "MMM d")} - ${format(friday, "MMM d")}`;
  return { monday, friday, number, range, label: `Week ${number} (${range})` };
}
