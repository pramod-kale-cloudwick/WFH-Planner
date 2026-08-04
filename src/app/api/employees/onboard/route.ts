import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq, max } from "drizzle-orm";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (existing.length > 0) return NextResponse.json({ error: "Already onboarded" }, { status: 400 });

    const body = await request.json();
    const { name, designation, wfhType, fixedDays } = body;
    if (!name?.trim() || !designation?.trim()) return NextResponse.json({ error: "Name and designation are required" }, { status: 400 });

    const existingAdmin = await db.select().from(employees).where(eq(employees.isAdmin, true)).limit(1);
    const isFirstUser = existingAdmin.length === 0;
    const maxOrderResult = await db.select({ maxOrder: max(employees.rotationOrder) }).from(employees);
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const newEmployee = await db.insert(employees).values({
      id: nanoid(),
      name: name.trim(),
      email: session.user.email,
      designation: designation.trim(),
      wfhType: wfhType || "rotating",
      fixedDays: JSON.stringify(fixedDays || []),
      rotationOrder: nextOrder,
      isActive: true,
      isAdmin: isFirstUser,
    }).returning();

    return NextResponse.json({ ...newEmployee[0], fixedDays: JSON.parse(newEmployee[0].fixedDays || "[]"), isFirstUser }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
