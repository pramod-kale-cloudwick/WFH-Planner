import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees, allocationEmployees, weekAllocations } from "@/lib/schema";
import { eq, and, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-utils";
import { format, startOfWeek } from "date-fns";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const admin = await isAdmin();
    const { id } = await params;

    // Get the employee
    const emp = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp.length) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    // Check authorization - admin or self
    if (!admin && emp[0].email !== session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { oldWfhType, newWfhType } = await request.json();
    if (!oldWfhType || !newWfhType || oldWfhType === newWfhType) {
      return NextResponse.json({ error: "Invalid type change" }, { status: 400 });
    }

    const currentWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), "yyyy-MM-dd");
    let removedCount = 0;
    let message = "";

    // Get all future allocations for this employee
    const futureAllocations = await db.select({ allocEmpId: allocationEmployees.id, allocationId: allocationEmployees.allocationId, weekStart: weekAllocations.weekStart })
      .from(allocationEmployees)
      .innerJoin(weekAllocations, eq(allocationEmployees.allocationId, weekAllocations.id))
      .where(and(eq(allocationEmployees.employeeId, id), gte(weekAllocations.weekStart, currentWeekStart)));

    if (newWfhType === "permanent_wfo") {
      // Remove from all future WFH allocations - they'll always be in office
      for (const alloc of futureAllocations) {
        await db.delete(allocationEmployees).where(eq(allocationEmployees.id, alloc.allocEmpId));
        removedCount++;
      }
      message = `Removed from ${removedCount} future WFH week(s). You'll now always work from office.`;
    } else if (newWfhType === "permanent_wfh") {
      // Remove from rotation - they always WFH anyway, no need to be in allocation slots
      for (const alloc of futureAllocations) {
        await db.delete(allocationEmployees).where(eq(allocationEmployees.id, alloc.allocEmpId));
        removedCount++;
      }
      message = `Removed from ${removedCount} rotation slot(s). You'll now always work from home.`;
    } else if (newWfhType === "rotating") {
      // Changed back to rotating - they'll be picked up in next schedule generation
      message = "You're now in the rotating pool. Run 'Generate Schedule' to include you in future weeks.";
    }

    return NextResponse.json({ success: true, removedCount, message });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update allocations" }, { status: 500 });
  }
}
