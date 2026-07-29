import { NextRequest, NextResponse } from "next/server";
import { getAllocationsForMonth, generateAllocations } from "@/lib/allocation-engine";
import { startOfWeek } from "date-fns";
import { isAdmin } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get("month") || new Date().getMonth().toString());

    const allocations = await getAllocationsForMonth(year, month);
    return NextResponse.json(allocations);
  } catch {
    return NextResponse.json({ error: "Failed to fetch allocations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const body = await request.json();
    const { weeksCount = 20 } = body;
    const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    await generateAllocations(startDate, weeksCount);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to generate allocations" }, { status: 500 });
  }
}
