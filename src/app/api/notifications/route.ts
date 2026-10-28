import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, notifications } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rows = await db.select({ id: notifications.id, message: notifications.message, createdAt: notifications.createdAt })
      .from(notifications).innerJoin(employees, eq(notifications.employeeId, employees.id))
      .where(eq(employees.email, session.user.email)).orderBy(desc(notifications.createdAt)).limit(20);
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
