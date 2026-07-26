import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const result = await db.select().from(settings).limit(1);
    if (result.length === 0) {
      const newSettings = await db.insert(settings).values({ availableSeats: 8, wfhPerWeek: 2, weekCycleLength: 5 }).returning();
      return NextResponse.json(newSettings[0]);
    }
    return NextResponse.json(result[0]);
  } catch {
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { availableSeats, wfhPerWeek, weekCycleLength } = body;

    const existing = await db.select().from(settings).limit(1);
    if (existing.length === 0) {
      const newSettings = await db.insert(settings).values({ availableSeats, wfhPerWeek, weekCycleLength }).returning();
      return NextResponse.json(newSettings[0]);
    }

    const updated = await db.update(settings).set({
      ...(availableSeats !== undefined && { availableSeats }),
      ...(wfhPerWeek !== undefined && { wfhPerWeek }),
      ...(weekCycleLength !== undefined && { weekCycleLength }),
    }).where(eq(settings.id, existing[0].id)).returning();

    return NextResponse.json(updated[0]);
  } catch {
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
