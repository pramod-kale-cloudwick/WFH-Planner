import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { swapRequests, employees, weekAllocations, allocationEmployees, swapHistory } from "@/lib/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUser = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (!currentUser.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const isAdmin = currentUser[0].isAdmin;
    const userId = currentUser[0].id;

    let requests;
    if (isAdmin) {
      requests = await db.select().from(swapRequests).orderBy(desc(swapRequests.createdAt));
    } else {
      requests = await db.select().from(swapRequests).where(or(eq(swapRequests.initiatorId, userId), eq(swapRequests.targetId, userId))).orderBy(desc(swapRequests.createdAt));
    }

    const allEmps = await db.select({ id: employees.id, name: employees.name }).from(employees);
    const empMap = new Map(allEmps.map((e) => [e.id, e.name]));

    const allAllocs = await db.select({ id: weekAllocations.id, weekNumber: weekAllocations.weekNumber, weekStart: weekAllocations.weekStart, weekEnd: weekAllocations.weekEnd }).from(weekAllocations);
    const allocMap = new Map(allAllocs.map((a) => [a.id, { weekNumber: a.weekNumber, weekStart: a.weekStart, weekEnd: a.weekEnd }]));

    const enriched = requests.map((r) => ({
      ...r,
      initiatorName: empMap.get(r.initiatorId) || "Unknown",
      targetName: empMap.get(r.targetId) || "Unknown",
      initiatorWeek: allocMap.get(r.initiatorAllocationId),
      targetWeek: allocMap.get(r.targetAllocationId),
    }));

    return NextResponse.json(enriched);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to fetch swap requests" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const currentUser = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (!currentUser.length) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { targetId, initiatorAllocationId, targetAllocationId } = await request.json();
    if (!targetId || !initiatorAllocationId || !targetAllocationId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify initiator is in the initiatorAllocation
    const initiatorInAlloc = await db.select().from(allocationEmployees).where(and(eq(allocationEmployees.allocationId, initiatorAllocationId), eq(allocationEmployees.employeeId, currentUser[0].id))).limit(1);
    if (!initiatorInAlloc.length) {
      return NextResponse.json({ error: "You are not in the selected week" }, { status: 400 });
    }

    // Verify target is in the targetAllocation
    const targetInAlloc = await db.select().from(allocationEmployees).where(and(eq(allocationEmployees.allocationId, targetAllocationId), eq(allocationEmployees.employeeId, targetId))).limit(1);
    if (!targetInAlloc.length) {
      return NextResponse.json({ error: "Target is not in the selected week" }, { status: 400 });
    }

    // Check if target is already in initiator's week (would result in duplicate)
    const targetAlreadyInInitiatorWeek = await db.select().from(allocationEmployees).where(and(eq(allocationEmployees.allocationId, initiatorAllocationId), eq(allocationEmployees.employeeId, targetId))).limit(1);
    if (targetAlreadyInInitiatorWeek.length) {
      return NextResponse.json({ error: "Target is already assigned to your week" }, { status: 400 });
    }

    // Check if initiator is already in target's week (would result in duplicate)
    const initiatorAlreadyInTargetWeek = await db.select().from(allocationEmployees).where(and(eq(allocationEmployees.allocationId, targetAllocationId), eq(allocationEmployees.employeeId, currentUser[0].id))).limit(1);
    if (initiatorAlreadyInTargetWeek.length) {
      return NextResponse.json({ error: "You are already assigned to the target week" }, { status: 400 });
    }

    // Check for existing pending request
    const existing = await db.select().from(swapRequests).where(and(eq(swapRequests.initiatorId, currentUser[0].id), eq(swapRequests.targetId, targetId), or(eq(swapRequests.status, "pending_target"), eq(swapRequests.status, "pending_admin")))).limit(1);
    if (existing.length) {
      return NextResponse.json({ error: "A pending swap request already exists with this user" }, { status: 400 });
    }

    const newRequest = await db.insert(swapRequests).values({ id: nanoid(), initiatorId: currentUser[0].id, targetId, initiatorAllocationId, targetAllocationId, status: "pending_target" }).returning();

    return NextResponse.json(newRequest[0], { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to create swap request" }, { status: 500 });
  }
}
