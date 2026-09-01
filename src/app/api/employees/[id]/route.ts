import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/auth-utils";
import { auth } from "@/lib/auth";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const admin = await isAdmin();
    const { id } = await params;

    if (!admin) {
      const emp = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
      if (!emp.length || emp[0].email !== session?.user?.email) {
        return NextResponse.json({ error: "You can only edit your own profile" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { name, email, designation, wfhType, fixedDays, isActive, rotationOrder } = body;

    const updated = await db.update(employees).set({
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email: email || null }),
      ...(designation !== undefined && { designation }),
      ...(wfhType !== undefined && { wfhType }),
      ...(fixedDays !== undefined && { fixedDays: JSON.stringify(fixedDays) }),
      ...(isActive !== undefined && { isActive }),
      ...(rotationOrder !== undefined && { rotationOrder }),
    }).where(eq(employees.id, id)).returning();

    if (!updated.length) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    return NextResponse.json({ ...updated[0], fixedDays: JSON.parse(updated[0].fixedDays || "[]") });
  } catch {
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const { id } = await params;
    const deleted = await db.delete(employees).where(eq(employees.id, id)).returning();
    if (!deleted.length) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete employee" }, { status: 500 });
  }
}
