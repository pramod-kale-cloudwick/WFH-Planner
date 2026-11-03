import { NextRequest, NextResponse } from "next/server";
import { differenceInCalendarWeeks, format, isValid, parseISO, startOfWeek } from "date-fns";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { employeeAway, employees, notifications } from "@/lib/schema";
import { isAdmin } from "@/lib/auth-utils";
import { applyAwayChange } from "@/lib/allocation-engine";
import { workWeek } from "@/lib/utils";

const MAX_WEEKS = 26;
const weekOf = (date: Date) => format(startOfWeek(date, { weekStartsOn: 0 }), "yyyy-MM-dd");
const toWeek = (d: string) => { const date = parseISO(d); return isValid(date) ? weekOf(date) : null; };

export async function GET() {
  try {
    const rows = await db.select().from(employeeAway).where(gte(employeeAway.toWeek, weekOf(new Date()))).orderBy(asc(employeeAway.fromWeek));
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch away periods" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const { employeeId, from, to, reason } = await request.json();
    const fromWeek = toWeek(String(from ?? "")), lastWeek = toWeek(String(to ?? "")), current = weekOf(new Date());
    if (!employeeId || !fromWeek || !lastWeek) return NextResponse.json({ error: "employeeId, from and to dates are required" }, { status: 400 });
    if (fromWeek > lastWeek) return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    if (fromWeek < current) return NextResponse.json({ error: "Away period can't start in a past week" }, { status: 400 });
    if (differenceInCalendarWeeks(parseISO(lastWeek), parseISO(fromWeek)) >= MAX_WEEKS) return NextResponse.json({ error: `Away period can be at most ${MAX_WEEKS} weeks; deactivate the employee instead` }, { status: 400 });

    const [emp] = await db.select({ name: employees.name }).from(employees).where(eq(employees.id, employeeId)).limit(1);
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    const [clash] = await db.select({ id: employeeAway.id }).from(employeeAway).where(and(eq(employeeAway.employeeId, employeeId), lte(employeeAway.fromWeek, lastWeek), gte(employeeAway.toWeek, fromWeek))).limit(1);
    if (clash) return NextResponse.json({ error: `${emp.name} already has an away period overlapping these weeks` }, { status: 409 });

    const range = `${workWeek(fromWeek).range} → ${workWeek(lastWeek).range}`, trimmed = typeof reason === "string" ? reason.trim().slice(0, 120) || null : null;
    const [row] = await db.insert(employeeAway).values({ id: nanoid(), employeeId, fromWeek, toWeek: lastWeek, reason: trimmed }).returning();
    await db.insert(notifications).values({ id: nanoid(), employeeId, message: `Admin marked you away for ${range}. WFH turns in this period lapse; rotation resumes when you're back.` });
    await applyAwayChange(fromWeek, lastWeek, `${emp.name} is away ${range}`).catch(console.error);
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Failed to save away period" }, { status: 500 });
  }
}
