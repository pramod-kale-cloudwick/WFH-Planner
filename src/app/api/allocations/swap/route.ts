import { NextRequest, NextResponse } from "next/server";
import { swapEmployees } from "@/lib/allocation-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { allocationId1, employeeId1, allocationId2, employeeId2 } = body;

    if (!allocationId1 || !employeeId1 || !allocationId2 || !employeeId2) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await swapEmployees(allocationId1, employeeId1, allocationId2, employeeId2);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to swap employees" }, { status: 500 });
  }
}
