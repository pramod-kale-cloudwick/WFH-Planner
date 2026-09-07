import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { asc, max } from "drizzle-orm";
import { nanoid } from "nanoid";
import { isAdmin } from "@/lib/auth-utils";

const ALL_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F97316", "#EC4899", "#06B6D4", "#EAB308", "#EF4444", "#6366F1", "#14B8A6", "#F59E0B", "#84CC16"];

function getUniqueColor(usedColors: string[]): string {
  const available = ALL_COLORS.filter((c) => !usedColors.includes(c));
  if (available.length === 0) return ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];
  return available[Math.floor(Math.random() * available.length)];
}

export async function GET() {
  try {
    const allEmployees = await db.select().from(employees).orderBy(asc(employees.rotationOrder));
    const parsed = allEmployees.map((emp) => ({ ...emp, fixedDays: JSON.parse(emp.fixedDays || "[]") }));
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const body = await request.json();
    const { name, email, designation, wfhType, fixedDays, color } = body;

    const maxOrderResult = await db.select({ maxOrder: max(employees.rotationOrder) }).from(employees);
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    // Get used colors for unique assignment
    const allEmps = await db.select({ color: employees.color }).from(employees);
    const usedColors = allEmps.map((e) => e.color).filter(Boolean) as string[];
    const assignedColor = color || getUniqueColor(usedColors);

    const newEmployee = await db.insert(employees).values({
      id: nanoid(),
      name,
      email: email || null,
      designation,
      wfhType: wfhType || "rotating",
      fixedDays: JSON.stringify(fixedDays || []),
      rotationOrder: nextOrder,
      isActive: true,
      color: assignedColor,
    }).returning();

    return NextResponse.json({ ...newEmployee[0], fixedDays: JSON.parse(newEmployee[0].fixedDays || "[]") }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
