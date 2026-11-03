import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { employees, feedback } from "@/lib/schema";
import type { FeedbackType } from "@/types";

const TYPES: FeedbackType[] = ["feedback", "feature", "bug"], MAX_LEN = 2000;
const columns = { id: feedback.id, employeeId: feedback.employeeId, type: feedback.type, message: feedback.message, status: feedback.status, createdAt: feedback.createdAt, authorName: employees.name };

const currentEmployee = async () => {
  const session = await auth();
  if (!session?.user?.email) return null;
  const [emp] = await db.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.email, session.user.email)).limit(1);
  return emp ? { ...emp, isAdmin: session.user.isAdmin ?? false } : null;
};

export async function GET() {
  try {
    const emp = await currentEmployee();
    if (!emp) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const query = db.select(columns).from(feedback).leftJoin(employees, eq(employees.id, feedback.employeeId)).orderBy(desc(feedback.createdAt)).limit(100);
    return NextResponse.json(await (emp.isAdmin ? query : query.where(eq(feedback.employeeId, emp.id))));
  } catch {
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const emp = await currentEmployee();
    if (!emp) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { type, message } = await request.json();
    const text = typeof message === "string" ? message.trim() : "";
    if (!TYPES.includes(type)) return NextResponse.json({ error: "Pick feedback, feature or bug" }, { status: 400 });
    if (!text) return NextResponse.json({ error: "Message is required" }, { status: 400 });
    if (text.length > MAX_LEN) return NextResponse.json({ error: `Message can be at most ${MAX_LEN} characters` }, { status: 400 });

    const [row] = await db.insert(feedback).values({ id: nanoid(), employeeId: emp.id, type, message: text }).returning();
    return NextResponse.json({ ...row, authorName: emp.name }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
