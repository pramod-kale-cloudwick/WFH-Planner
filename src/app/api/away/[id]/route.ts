import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { employeeAway, employees, notifications } from "@/lib/schema";
import { isAdmin } from "@/lib/auth-utils";
import { applyAwayChange } from "@/lib/allocation-engine";
import { workWeek } from "@/lib/utils";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const { id } = await params;
    const [row] = await db.select({ employeeId: employeeAway.employeeId, fromWeek: employeeAway.fromWeek, toWeek: employeeAway.toWeek, name: employees.name }).from(employeeAway).innerJoin(employees, eq(employees.id, employeeAway.employeeId)).where(eq(employeeAway.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: "Away period not found" }, { status: 404 });

    const range = `${workWeek(row.fromWeek).range} → ${workWeek(row.toWeek).range}`;
    await db.batch([
      db.delete(employeeAway).where(eq(employeeAway.id, id)),
      db.insert(notifications).values({ id: nanoid(), employeeId: row.employeeId, message: `Your away period (${range}) was cancelled. You're back in the rotation.` }),
    ]);
    await applyAwayChange(row.fromWeek, row.toWeek, `${row.name}'s away period cancelled`).catch(console.error);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to cancel away period" }, { status: 500 });
  }
}
