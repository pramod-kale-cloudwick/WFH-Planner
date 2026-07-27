import { startOfWeek, endOfWeek, addWeeks, format, parseISO } from "date-fns";
import { db } from "./db";
import { employees, weekAllocations, allocationEmployees, settings, swapHistory } from "./schema";
import { eq, and, asc, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Employee, WeekAllocation, Settings } from "@/types";

export async function getSettings(): Promise<Settings> {
  const result = await db.select().from(settings).limit(1);
  if (result.length === 0) {
    const newSettings = await db.insert(settings).values({ availableSeats: 6, weekCycleLength: 4 }).returning();
    return { ...newSettings[0], wfhPerWeek: 0 } as Settings;
  }
  return { ...result[0], wfhPerWeek: 0 } as Settings;
}

export async function getRotatingEmployees() {
  return db.select().from(employees).where(and(eq(employees.wfhType, "rotating"), eq(employees.isActive, true))).orderBy(asc(employees.rotationOrder));
}

export async function generateAllocations(startDate: Date, weeksCount: number): Promise<void> {
  const config = await getSettings();
  const rotatingEmps = await getRotatingEmployees();

  if (rotatingEmps.length === 0) return;

  // Auto-calculate WFH per week: employees that can't fit in office
  const wfhPerWeek = Math.max(0, rotatingEmps.length - config.availableSeats);
  if (wfhPerWeek === 0) return; // Everyone fits, no WFH rotation needed

  let rotationIndex = 0;

  for (let i = 0; i < weeksCount; i++) {
    const weekStart = startOfWeek(addWeeks(startDate, i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, "yyyy-MM-dd");
    const weekEndStr = format(weekEnd, "yyyy-MM-dd");

    const existing = await db.select().from(weekAllocations).where(eq(weekAllocations.weekStart, weekStartStr)).limit(1);
    if (existing.length > 0 && existing[0].isOverride) continue;
    if (existing.length > 0) {
      await db.delete(allocationEmployees).where(eq(allocationEmployees.allocationId, existing[0].id));
      await db.delete(weekAllocations).where(eq(weekAllocations.id, existing[0].id));
    }

    const weekNumber = (i % config.weekCycleLength) + 1;
    const allocationId = nanoid();
    await db.insert(weekAllocations).values({ id: allocationId, weekStart: weekStartStr, weekEnd: weekEndStr, weekNumber, isOverride: false });

    for (let j = 0; j < wfhPerWeek; j++) {
      const empIndex = (rotationIndex + j) % rotatingEmps.length;
      await db.insert(allocationEmployees).values({ id: nanoid(), allocationId, employeeId: rotatingEmps[empIndex].id });
    }
    rotationIndex = (rotationIndex + wfhPerWeek) % rotatingEmps.length;
  }
}

export async function getAllocationsForMonth(year: number, month: number): Promise<WeekAllocation[]> {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  const startStr = format(startOfWeek(startDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const endStr = format(endOfWeek(endDate, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const allocations = await db.select().from(weekAllocations).where(and(gte(weekAllocations.weekStart, startStr), lte(weekAllocations.weekStart, endStr))).orderBy(asc(weekAllocations.weekStart));

  const result: WeekAllocation[] = [];
  for (const alloc of allocations) {
    const empLinks = await db.select().from(allocationEmployees).where(eq(allocationEmployees.allocationId, alloc.id));
    const empIds = empLinks.map((e) => e.employeeId);
    const allEmps: Employee[] = [];
    for (const empId of empIds) {
      const emp = await db.select().from(employees).where(eq(employees.id, empId));
      if (emp.length > 0) allEmps.push(emp[0] as unknown as Employee);
    }
    const swaps = await db.select().from(swapHistory).where(eq(swapHistory.allocationId, alloc.id));
    const swapDetails: { fromName: string; toName: string }[] = [];
    for (const swap of swaps) {
      const fromEmp = await db.select().from(employees).where(eq(employees.id, swap.fromEmployeeId));
      const toEmp = await db.select().from(employees).where(eq(employees.id, swap.toEmployeeId));
      if (fromEmp.length && toEmp.length) swapDetails.push({ fromName: fromEmp[0].name, toName: toEmp[0].name });
    }
    result.push({ id: alloc.id, weekStart: parseISO(alloc.weekStart), weekEnd: parseISO(alloc.weekEnd), weekNumber: alloc.weekNumber, isOverride: alloc.isOverride, createdAt: alloc.createdAt, employees: allEmps, swaps: swapDetails });
  }
  return result;
}

export async function swapEmployees(allocationId1: string, employeeId1: string, allocationId2: string, employeeId2: string): Promise<void> {
  await db.update(allocationEmployees).set({ employeeId: employeeId2 }).where(and(eq(allocationEmployees.allocationId, allocationId1), eq(allocationEmployees.employeeId, employeeId1)));
  await db.update(allocationEmployees).set({ employeeId: employeeId1 }).where(and(eq(allocationEmployees.allocationId, allocationId2), eq(allocationEmployees.employeeId, employeeId2)));
  await db.update(weekAllocations).set({ isOverride: true }).where(eq(weekAllocations.id, allocationId1));
  await db.update(weekAllocations).set({ isOverride: true }).where(eq(weekAllocations.id, allocationId2));
  await db.insert(swapHistory).values({ id: nanoid(), allocationId: allocationId1, fromEmployeeId: employeeId1, toEmployeeId: employeeId2 });
  await db.insert(swapHistory).values({ id: nanoid(), allocationId: allocationId2, fromEmployeeId: employeeId2, toEmployeeId: employeeId1 });
}
