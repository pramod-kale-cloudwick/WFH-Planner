import { NextResponse } from "next/server";
import { clearAllocations } from "@/lib/allocation-engine";
import { isAdmin } from "@/lib/auth-utils";

export async function DELETE() {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    await clearAllocations();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to clear allocations" }, { status: 500 });
  }
}
