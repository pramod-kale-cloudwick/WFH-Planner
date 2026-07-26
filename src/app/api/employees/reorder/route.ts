import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { employees } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderedIds } = body as { orderedIds: string[] };

    await Promise.all(
      orderedIds.map((id, index) => db.update(employees).set({ rotationOrder: index }).where(eq(employees.id, id)))
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder employees" }, { status: 500 });
  }
}
