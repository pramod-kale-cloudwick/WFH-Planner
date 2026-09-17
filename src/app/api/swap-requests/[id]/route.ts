import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { swapRequests, employees, allocationEmployees, swapHistory } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { nanoid } from "nanoid";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUser = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (!currentUser.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const { action } = await request.json();

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const swapReq = await db.select().from(swapRequests).where(eq(swapRequests.id, id)).limit(1);
    if (!swapReq.length) return NextResponse.json({ error: "Swap request not found" }, { status: 404 });

    const req = swapReq[0];
    const isAdmin = currentUser[0].isAdmin;
    const isTarget = currentUser[0].id === req.targetId;

    // Validate who can take action based on status
    if (req.status === "pending_target") {
      if (!isTarget) return NextResponse.json({ error: "Only the target can respond to this request" }, { status: 403 });

      if (action === "reject") {
        await db.update(swapRequests).set({ status: "rejected", rejectedBy: "target", updatedAt: new Date() }).where(eq(swapRequests.id, id));
        return NextResponse.json({ success: true, message: "Swap request rejected" });
      }

      // Target approved, move to pending_admin
      await db.update(swapRequests).set({ status: "pending_admin", updatedAt: new Date() }).where(eq(swapRequests.id, id));
      return NextResponse.json({ success: true, message: "Swap request approved by target, pending admin approval" });
    }

    if (req.status === "pending_admin") {
      if (!isAdmin) return NextResponse.json({ error: "Only admin can approve/reject at this stage" }, { status: 403 });

      if (action === "reject") {
        await db.update(swapRequests).set({ status: "rejected", rejectedBy: "admin", updatedAt: new Date() }).where(eq(swapRequests.id, id));
        return NextResponse.json({ success: true, message: "Swap request rejected by admin" });
      }

      // Admin approved - execute the swap
      // Update allocation_employees: swap initiator into target's week and target into initiator's week
      await db.update(allocationEmployees).set({ employeeId: req.targetId }).where(and(eq(allocationEmployees.allocationId, req.initiatorAllocationId), eq(allocationEmployees.employeeId, req.initiatorId)));
      await db.update(allocationEmployees).set({ employeeId: req.initiatorId }).where(and(eq(allocationEmployees.allocationId, req.targetAllocationId), eq(allocationEmployees.employeeId, req.targetId)));

      // Record in swap history
      await db.insert(swapHistory).values([
        { id: nanoid(), allocationId: req.initiatorAllocationId, fromEmployeeId: req.initiatorId, toEmployeeId: req.targetId },
        { id: nanoid(), allocationId: req.targetAllocationId, fromEmployeeId: req.targetId, toEmployeeId: req.initiatorId },
      ]);

      // Mark request as approved
      await db.update(swapRequests).set({ status: "approved", updatedAt: new Date() }).where(eq(swapRequests.id, id));
      return NextResponse.json({ success: true, message: "Swap completed successfully" });
    }

    return NextResponse.json({ error: "Request is already processed" }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to process swap request" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUser = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (!currentUser.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { id } = await params;
    const swapReq = await db.select().from(swapRequests).where(eq(swapRequests.id, id)).limit(1);
    if (!swapReq.length) return NextResponse.json({ error: "Swap request not found" }, { status: 404 });

    // Only initiator or admin can delete
    if (currentUser[0].id !== swapReq[0].initiatorId && !currentUser[0].isAdmin) {
      return NextResponse.json({ error: "You can only cancel your own requests" }, { status: 403 });
    }

    // Can only delete pending requests
    if (!["pending_target", "pending_admin"].includes(swapReq[0].status)) {
      return NextResponse.json({ error: "Cannot cancel a processed request" }, { status: 400 });
    }

    await db.delete(swapRequests).where(eq(swapRequests.id, id));
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to delete swap request" }, { status: 500 });
  }
}
