import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { feedback, notifications } from "@/lib/schema";
import { isAdmin } from "@/lib/auth-utils";

const LABEL = { feedback: "feedback", feature: "feature request", bug: "bug report" } as const;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdmin())) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const [{ id }, { status }] = await Promise.all([params, request.json()]);
    if (status !== "open" && status !== "resolved") return NextResponse.json({ error: "Invalid status" }, { status: 400 });

    const [row] = await db.update(feedback).set({ status }).where(eq(feedback.id, id)).returning();
    if (!row) return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    if (status === "resolved") await db.insert(notifications).values({ id: nanoid(), employeeId: row.employeeId, message: `Your ${LABEL[row.type]} "${row.message.slice(0, 60)}${row.message.length > 60 ? "…" : ""}" was marked resolved. Thanks!` });
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
  }
}
