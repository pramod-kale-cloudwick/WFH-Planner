import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { asc, max } from "drizzle-orm";
import { nanoid } from "nanoid";
import { isAdmin } from "@/lib/auth-utils";

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
    const { name, designation, wfhType, fixedDays } = body;

    const maxOrderResult = await db.select({ maxOrder: max(employees.rotationOrder) }).from(employees);
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const newEmployee = await db.insert(employees).values({
      id: nanoid(),
      name,
      designation,
      wfhType: wfhType || "rotating",
      fixedDays: JSON.stringify(fixedDays || []),
      rotationOrder: nextOrder,
      isActive: true,
    }).returning();

    return NextResponse.json({ ...newEmployee[0], fixedDays: JSON.parse(newEmployee[0].fixedDays || "[]") }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
