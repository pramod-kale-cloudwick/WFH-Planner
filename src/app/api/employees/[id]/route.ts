import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, allocationEmployees, swapHistory, swapRequests, dateAnnotations, dayBumps, notifications } from "@/lib/schema";
import { eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { rebalanceSchedule } from "@/lib/allocation-engine";

const TYPE_CHANGE_MESSAGES: Record<string, string> = {
  permanent_wfo: "You'll always work from office. Future WFH weeks are re-planned (next week stays as is).",
  permanent_wfh: "You'll always work from home. Future weeks are re-planned (next week stays as is).",
  rotating: "You're in the rotation now. Future weeks are re-planned (next week stays as is).",
};

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const admin = session?.user?.isAdmin ?? false;
    const { id } = await params;

    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    const isSelf = emp.email === session?.user?.email;
    if (!admin && !isSelf) return NextResponse.json({ error: "You can only edit your own profile" }, { status: 403 });

    const body = await request.json();
    const { name, email, designation, wfhType, fixedDays, isActive, color } = body;
    // Email is the login link to the session, so changing your own would lock you out
    const canChangeEmail = admin && !isSelf;

    const [updated] = await db.update(employees).set({
      ...(name !== undefined && { name }),
      ...(canChangeEmail && email !== undefined && { email: email || null }),
      ...(designation !== undefined && { designation }),
      ...(wfhType !== undefined && { wfhType }),
      ...(fixedDays !== undefined && { fixedDays: JSON.stringify(fixedDays) }),
      ...(isActive !== undefined && { isActive }),
      ...(color !== undefined && { color: color || null }),
    }).where(eq(employees.id, id)).returning();

    const typeChanged = updated.wfhType !== emp.wfhType;
    if (typeChanged || updated.isActive !== emp.isActive || updated.fixedDays !== emp.fixedDays) {
      await rebalanceSchedule(`${updated.name}'s preferences changed`).catch(console.error);
    }
    return NextResponse.json({ ...updated, fixedDays: JSON.parse(updated.fixedDays || "[]"), ...(typeChanged && { message: TYPE_CHANGE_MESSAGES[updated.wfhType] }) });
  } catch {
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const { id } = await params;

    const [emp] = await db.select({ email: employees.email, name: employees.name }).from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    if (emp.email === session.user.email) return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });

    // Turso over HTTP doesn't enforce FK cascades, so dependents are removed explicitly
    await db.batch([
      db.delete(allocationEmployees).where(eq(allocationEmployees.employeeId, id)),
      db.delete(swapHistory).where(or(eq(swapHistory.fromEmployeeId, id), eq(swapHistory.toEmployeeId, id))),
      db.delete(swapRequests).where(or(eq(swapRequests.initiatorId, id), eq(swapRequests.targetId, id))),
      db.delete(dateAnnotations).where(eq(dateAnnotations.authorId, id)),
      db.delete(dayBumps).where(or(eq(dayBumps.employeeId, id), eq(dayBumps.forEmployeeId, id))),
      db.delete(notifications).where(eq(notifications.employeeId, id)),
      db.delete(employees).where(eq(employees.id, id)),
    ]);
    await rebalanceSchedule(`${emp.name} left`).catch(console.error);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
