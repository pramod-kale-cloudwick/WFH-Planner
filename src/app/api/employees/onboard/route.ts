import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq, max } from "drizzle-orm";
import { nanoid } from "nanoid";

const ALL_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F97316", "#EC4899", "#06B6D4", "#EAB308", "#EF4444", "#6366F1", "#14B8A6", "#F59E0B", "#84CC16"];

function getUniqueColor(usedColors: string[]): string {
  const available = ALL_COLORS.filter((c) => !usedColors.includes(c));
  if (available.length === 0) return ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)];
  return available[Math.floor(Math.random() * available.length)];
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (existing.length > 0) return NextResponse.json({ error: "Already onboarded" }, { status: 400 });

    const body = await request.json();
    const { name, designation, wfhType, fixedDays, color } = body;
    if (!name?.trim() || !designation?.trim()) return NextResponse.json({ error: "Name and designation are required" }, { status: 400 });

    const existingAdmin = await db.select().from(employees).where(eq(employees.isAdmin, true)).limit(1);
    const isFirstUser = existingAdmin.length === 0;
    const maxOrderResult = await db.select({ maxOrder: max(employees.rotationOrder) }).from(employees);
    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    // Get used colors for unique assignment
    const allEmps = await db.select({ color: employees.color }).from(employees);
    const usedColors = allEmps.map((e) => e.color).filter(Boolean) as string[];
    const assignedColor = color || getUniqueColor(usedColors);

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
      color: assignedColor,
    }).returning();

    return NextResponse.json({ ...newEmployee[0], fixedDays: JSON.parse(newEmployee[0].fixedDays || "[]"), isFirstUser }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
