import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dateAnnotations, employees } from "@/lib/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const recent = await db.select({ id: dateAnnotations.id, date: dateAnnotations.date, message: dateAnnotations.message, authorId: dateAnnotations.authorId, createdAt: dateAnnotations.createdAt, authorName: employees.name }).from(dateAnnotations).leftJoin(employees, eq(dateAnnotations.authorId, employees.id)).orderBy(desc(dateAnnotations.createdAt)).limit(10);
    return NextResponse.json(recent);
  } catch {
    return NextResponse.json({ error: "Failed to fetch recent annotations" }, { status: 500 });
  }
}
