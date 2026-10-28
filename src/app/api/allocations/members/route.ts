import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth-utils";
import { setWeekMember } from "@/lib/allocation-engine";

export async function POST(request: NextRequest) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const { weekStart, employeeId, action, force } = await request.json();
    if (!weekStart || !employeeId || !["add", "remove"].includes(action)) return NextResponse.json({ error: "weekStart, employeeId and action (add | remove) are required" }, { status: 400 });

    const result = await setWeekMember(weekStart, employeeId, action, !!force);
    if (!result.ok) return NextResponse.json({ error: result.error, needsConfirm: result.needsConfirm }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update week" }, { status: 500 });
  }
}
