import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { swapHistory, employees, weekAllocations } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const swaps = await db.select({
      id: swapHistory.id,
      allocationId: swapHistory.allocationId,
      fromEmployeeId: swapHistory.fromEmployeeId,
      toEmployeeId: swapHistory.toEmployeeId,
      swappedAt: swapHistory.swappedAt,
      weekStart: weekAllocations.weekStart,
      weekEnd: weekAllocations.weekEnd,
      weekNumber: weekAllocations.weekNumber,
    }).from(swapHistory)
      .leftJoin(weekAllocations, eq(swapHistory.allocationId, weekAllocations.id))
      .orderBy(desc(swapHistory.swappedAt));

    const allEmps = await db.select({ id: employees.id, name: employees.name }).from(employees);
    const empMap = new Map(allEmps.map((e) => [e.id, e.name]));

    const result = swaps.map((s) => ({
      ...s,
      fromEmployeeName: empMap.get(s.fromEmployeeId) || "Unknown",
      toEmployeeName: empMap.get(s.toEmployeeId) || "Unknown",
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Failed to fetch swap history" }, { status: 500 });
  }
}
