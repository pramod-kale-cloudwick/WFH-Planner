import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, notifications } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { isAdmin } from "@/lib/auth-utils";
import { rebalanceSchedule } from "@/lib/allocation-engine";

/** Admin decision on a pending Spectator request: approve switches them to view-only and re-plans, reject keeps them as is. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const [{ id }, { approve }] = await Promise.all([params, request.json()]);
    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    if (!emp.spectatorRequested) return NextResponse.json({ error: "No pending Spectator request" }, { status: 400 });

    await db.batch([
      db.update(employees).set({ spectatorRequested: false, ...(approve && { wfhType: "spectator" as const, fixedDays: "[]" }) }).where(eq(employees.id, id)),
      db.insert(notifications).values({ id: nanoid(), employeeId: id, message: approve ? "Your Spectator request was approved. You're view-only and not part of the plan." : "Your Spectator request was declined. You stay in the plan as before." }),
    ]);
    if (approve) await rebalanceSchedule(`${emp.name} became a spectator`).catch(console.error);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update Spectator request" }, { status: 500 });
  }
}
