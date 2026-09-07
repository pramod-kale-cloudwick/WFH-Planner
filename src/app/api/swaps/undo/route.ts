import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { swapHistory, allocationEmployees } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { isAdmin } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const { swapId } = await request.json();
    if (!swapId) return NextResponse.json({ error: "Swap ID required" }, { status: 400 });

    const swap = await db.select().from(swapHistory).where(eq(swapHistory.id, swapId)).limit(1);
    if (!swap.length) return NextResponse.json({ error: "Swap not found" }, { status: 404 });

    const { allocationId: alloc1, fromEmployeeId: from1, toEmployeeId: to1 } = swap[0];

    // Find the paired reverse swap record (the other half of the swap)
    const reverseSwap = await db.select().from(swapHistory).where(and(eq(swapHistory.fromEmployeeId, to1), eq(swapHistory.toEmployeeId, from1))).limit(1);

    // Undo first allocation: in alloc1, replace to1 back with from1
    await db.update(allocationEmployees).set({ employeeId: from1 }).where(and(eq(allocationEmployees.allocationId, alloc1), eq(allocationEmployees.employeeId, to1)));

    // Undo second allocation if reverse exists
    if (reverseSwap.length) {
      const { allocationId: alloc2, fromEmployeeId: from2, toEmployeeId: to2 } = reverseSwap[0];
      await db.update(allocationEmployees).set({ employeeId: from2 }).where(and(eq(allocationEmployees.allocationId, alloc2), eq(allocationEmployees.employeeId, to2)));
      await db.delete(swapHistory).where(eq(swapHistory.id, reverseSwap[0].id));
    }

    // Delete the original swap record
    await db.delete(swapHistory).where(eq(swapHistory.id, swapId));

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to undo swap" }, { status: 500 });
  }
}
