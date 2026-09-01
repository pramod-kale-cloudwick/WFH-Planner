import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dateAnnotations, employees } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/auth-utils";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const annotation = await db.select().from(dateAnnotations).where(eq(dateAnnotations.id, id)).limit(1);
    if (!annotation.length) return NextResponse.json({ error: "Annotation not found" }, { status: 404 });

    const admin = await isAdmin();
    const emp = await db.select().from(employees).where(eq(employees.email, session.user.email)).limit(1);
    if (!admin && (!emp.length || emp[0].id !== annotation[0].authorId)) {
      return NextResponse.json({ error: "You can only delete your own annotations" }, { status: 403 });
    }

    await db.delete(dateAnnotations).where(eq(dateAnnotations.id, id));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete annotation" }, { status: 500 });
  }
}
