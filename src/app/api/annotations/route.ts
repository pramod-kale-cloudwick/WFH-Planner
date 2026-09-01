import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dateAnnotations, employees } from "@/lib/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = db.select({ id: dateAnnotations.id, date: dateAnnotations.date, message: dateAnnotations.message, authorId: dateAnnotations.authorId, createdAt: dateAnnotations.createdAt, authorName: employees.name }).from(dateAnnotations).leftJoin(employees, eq(dateAnnotations.authorId, employees.id));

    if (startDate && endDate) {
      query = query.where(and(gte(dateAnnotations.date, startDate), lte(dateAnnotations.date, endDate))) as typeof query;
    }

    const annotations = await query;
    return NextResponse.json(annotations);
  } catch {
    return NextResponse.json({ error: "Failed to fetch annotations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const emp = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (!emp.length) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const body = await request.json();
    const { date, message } = body;
    if (!date || !message?.trim()) return NextResponse.json({ error: "Date and message are required" }, { status: 400 });

    const annotation = await db.insert(dateAnnotations).values({ id: nanoid(), date, message: message.trim(), authorId: emp[0].id }).returning();
    return NextResponse.json({ ...annotation[0], authorName: emp[0].name }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create annotation" }, { status: 500 });
  }
}
