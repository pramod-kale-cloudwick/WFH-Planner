import { startOfWeek, endOfWeek, addWeeks, addDays, format, parseISO, differenceInCalendarWeeks } from "date-fns";
import { db } from "./db";
import { employees, weekAllocations, allocationEmployees, settings, swapHistory, swapRequests, dayBumps, notifications, employeeAway } from "./schema";
import { eq, and, or, asc, desc, gte, lte, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { nanoid } from "nanoid";
import type { Employee, WeekAllocation, Settings, WeekDay } from "@/types";
import { workWeek } from "./utils";

type Batch = [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];
type Emp = typeof employees.$inferSelect;
type Away = { employeeId: string; fromWeek: string; toWeek: string };
type Ctx = { seats: number; cycle: number; rotating: Emp[]; wfo: Emp[]; permWfh: Emp[]; fixed: Map<string, WeekDay[]>; rank: Map<string, number>; bumpCount: Map<string, number>; away: Away[] };
export type ScheduleChange = { employeeId: string; added: string[]; removed: string[] };

const WEEK_OPTS = { weekStartsOn: 0 } as const;
const WEEKDAYS: WeekDay[] = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const FREEZE_WEEKS = 1;
const DEFAULT_WEEKS = 20;
const toDay = (d: Date) => format(d, "yyyy-MM-dd");
const pretty = (weekStart: string) => workWeek(weekStart).range;
const currentWeekStart = () => toDay(startOfWeek(new Date(), WEEK_OPTS));
const runBatch = (ops: BatchItem<"sqlite">[]) => (ops.length ? db.batch(ops as Batch) : Promise.resolve());

export async function getSettings(): Promise<Settings> {
  const result = await db.select().from(settings).limit(1);
  if (result.length === 0) {
    const newSettings = await db.insert(settings).values({ availableSeats: 8, weekCycleLength: 5 }).returning();
    return { ...newSettings[0], wfhPerWeek: 0 } as Settings;
  }
  return { ...result[0], wfhPerWeek: 0 } as Settings;
}

// Alphabetical rotation key; id suffix keeps duplicate names distinct and stable
const sortKey = (e: { id: string; name: string }) => `${e.name.toLowerCase()}\u0000${e.id}`;
const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

async function loadContext(): Promise<Ctx> {
  const [config, active, bumps, away] = await Promise.all([getSettings(), db.select().from(employees).where(eq(employees.isActive, true)), db.select({ employeeId: dayBumps.employeeId }).from(dayBumps), db.select({ employeeId: employeeAway.employeeId, fromWeek: employeeAway.fromWeek, toWeek: employeeAway.toWeek }).from(employeeAway)]);
  const sorted = active.sort((a, b) => byKey(sortKey(a), sortKey(b)));
  const rotating = sorted.filter((e) => e.wfhType === "rotating");
  const bumpCount = new Map<string, number>();
  bumps.forEach((b) => bumpCount.set(b.employeeId, (bumpCount.get(b.employeeId) ?? 0) + 1));
  return {
    seats: config.availableSeats, cycle: config.weekCycleLength, rotating, bumpCount, away,
    wfo: sorted.filter((e) => e.wfhType === "permanent_wfo"), permWfh: sorted.filter((e) => e.wfhType === "permanent_wfh"),
    fixed: new Map(sorted.map((e) => [e.id, JSON.parse(e.fixedDays || "[]") as WeekDay[]])), rank: new Map(rotating.map((e, i) => [e.id, i])),
  };
}

const awayIn = (ctx: Ctx, weekStart: string) => new Set(ctx.away.filter((a) => a.fromWeek <= weekStart && weekStart <= a.toWeek).map((a) => a.employeeId));
const officeHeadcount = (ctx: Ctx, wfh: Set<string>, away: Set<string>) => [...ctx.rotating, ...ctx.wfo].filter((e) => !wfh.has(e.id) && !away.has(e.id)).length;

/**
 * Permanent-WFH employees come in on their fixed office days; office-going rotating and permanent-WFO employees stay home on their fixed WFH days.
 * When that overflows seats, the in-office rotating employees with the fewest past bumps (alphabetical tie-break) get that single day as WFH instead.
 * Only resolves fixed-day overflow; an admin-forced overflow is left as is.
 */
function planBumps(ctx: Ctx, allocationId: string, weekStart: string, wfhIds: string[]) {
  const wfh = new Set(wfhIds), away = awayIn(ctx, weekStart), present = (e: Emp) => !wfh.has(e.id) && !away.has(e.id);
  const inOffice = ctx.rotating.filter(present), officeGoers = [...inOffice, ...ctx.wfo.filter(present)];
  const base = officeHeadcount(ctx, wfh, away);
  const rows: (typeof dayBumps.$inferInsert)[] = [];
  WEEKDAYS.forEach((day, i) => {
    const hasFixed = (e: Emp) => ctx.fixed.get(e.id)?.includes(day) ?? false;
    const comers = ctx.permWfh.filter((e) => hasFixed(e) && !away.has(e.id));
    // Office-goers on a fixed WFH day free their seat
    const overflow = Math.min(comers.length, base - officeGoers.filter(hasFixed).length + comers.length - ctx.seats);
    if (overflow <= 0) return;
    const date = toDay(addDays(parseISO(weekStart), i + 1));
    const byFewestBumps = (a: Emp, b: Emp) => (ctx.bumpCount.get(a.id) ?? 0) - (ctx.bumpCount.get(b.id) ?? 0) || (ctx.rank.get(a.id) ?? 0) - (ctx.rank.get(b.id) ?? 0);
    inOffice.filter((e) => !hasFixed(e)).sort(byFewestBumps).slice(0, overflow).forEach((e, k) => {
      rows.push({ id: nanoid(), allocationId, date, employeeId: e.id, forEmployeeId: comers[k].id });
      ctx.bumpCount.set(e.id, (ctx.bumpCount.get(e.id) ?? 0) + 1);
    });
  });
  return rows;
}

/**
 * Rebuilds WFH weeks from `startDate` for `weeksCount` weeks and returns who gained/lost WFH weeks.
 * - Seats are reduced by permanent-WFO employees; overflow of rotating employees goes WFH.
 * - Rotation is a pure alphabetical cycle: each week continues after the alphabetically-last person of the
 *   previous week's block, so joiners/leavers fall into place by name (a,b,d,e + c => a,b,c,d,e).
 * - Swapped/edited (override) weeks and weeks up to FREEZE_WEEKS ahead are kept; overrides consume a normal slot.
 */
export async function generateAllocations(startDate: Date, weeksCount: number, { reset = false } = {}): Promise<ScheduleChange[]> {
  const [ctx, everyone] = await Promise.all([loadContext(), db.select({ id: employees.id, name: employees.name }).from(employees)]);
  const { rotating } = ctx;
  const n = rotating.length;
  const wfhPerWeek = Math.max(0, n - Math.max(0, ctx.seats - ctx.wfo.length));

  const firstWeek = startOfWeek(startDate, WEEK_OPTS);
  const freezeUntil = toDay(addWeeks(parseISO(currentWeekStart()), FREEZE_WEEKS));
  const weeks = Array.from({ length: weeksCount }, (_, i) => { const ws = addWeeks(firstWeek, i); return { start: toDay(ws), end: toDay(endOfWeek(ws, WEEK_OPTS)), number: (i % ctx.cycle) + 1 }; });
  if (!weeks.length) return [];

  const rows = await db.select({ id: weekAllocations.id, weekStart: weekAllocations.weekStart, isOverride: weekAllocations.isOverride, employeeId: allocationEmployees.employeeId })
    .from(weekAllocations).leftJoin(allocationEmployees, eq(allocationEmployees.allocationId, weekAllocations.id))
    .where(lte(weekAllocations.weekStart, weeks[weeks.length - 1].start)).orderBy(asc(weekAllocations.weekStart));

  const byWeek = new Map<string, { id: string; isOverride: boolean; empIds: string[] }>();
  for (const r of rows) {
    const w = byWeek.get(r.weekStart) ?? { id: r.id, isOverride: r.isOverride, empIds: [] };
    if (r.employeeId) w.empIds.push(r.employeeId);
    byWeek.set(r.weekStart, w);
  }

  const keyOf = new Map(everyone.map((e) => [e.id, sortKey(e)]));
  const rotatingKeys = rotating.map(sortKey);
  let pointer = 0;
  // Block end = member closing the longest run in the name ring (rotating + this week's members, incl. people who since left); away people are transparent
  const continueAfter = (weekStart: string, empIds: string[]) => {
    const members = new Set(empIds.flatMap((id) => keyOf.get(id) ?? []));
    if (!members.size || !n) return;
    const away = new Set([...awayIn(ctx, weekStart)].flatMap((id) => keyOf.get(id) ?? []));
    const ring = [...new Set([...rotatingKeys.filter((k) => !away.has(k)), ...members])].sort(byKey);
    let end = "", bestLen = 0;
    ring.forEach((k, i) => {
      if (!members.has(k) || members.has(ring[(i + 1) % ring.length])) return;
      let len = 1;
      while (len < ring.length && members.has(ring[(i - len + ring.length) % ring.length])) len++;
      if (len > bestLen) { end = k; bestLen = len; }
    });
    const next = rotatingKeys.findIndex((k) => k > end);
    pointer = next === -1 ? 0 : next;
  };
  const skipSlot = () => { if (n) pointer = (pointer + wfhPerWeek) % n; };
  const applyLocked = (weekStart: string, w: { isOverride: boolean; empIds: string[] }) => (w.isOverride ? skipSlot() : continueAfter(weekStart, w.empIds));
  for (const [weekStart, w] of byWeek) if (weekStart < weeks[0].start) applyLocked(weekStart, w);
  // Walks the ring from the pointer: away people consume their turn (lapse), each absent office-goer means one fewer WFH pick
  const pickWeek = (weekStart: string) => {
    const away = awayIn(ctx, weekStart), need = Math.min(n, Math.max(0, officeHeadcount(ctx, new Set(), away) - ctx.seats)), picked: string[] = [];
    for (let s = 0; s < n && picked.length < need; s++) { const e = rotating[pointer]; pointer = (pointer + 1) % n; if (!away.has(e.id)) picked.push(e.id); }
    return picked;
  };

  const changes = new Map<string, { before: Set<string>; after: Set<string> }>();
  const track = (id: string, key: "before" | "after", week: string) => { const c = changes.get(id) ?? { before: new Set(), after: new Set() }; c[key].add(week); changes.set(id, c); };
  const staleIds: string[] = [];
  const newWeeks: (typeof weekAllocations.$inferInsert)[] = [];
  const newLinks: (typeof allocationEmployees.$inferInsert)[] = [];
  const newBumps: (typeof dayBumps.$inferInsert)[] = [];

  for (const week of weeks) {
    const existing = byWeek.get(week.start);
    if (existing && !reset && (existing.isOverride || week.start <= freezeUntil)) { applyLocked(week.start, existing); continue; }
    if (existing) { staleIds.push(existing.id); existing.empIds.forEach((id) => track(id, "before", week.start)); }

    const picked = pickWeek(week.start);
    if (!picked.length && !wfhPerWeek) continue;
    const allocationId = nanoid();
    newWeeks.push({ id: allocationId, weekStart: week.start, weekEnd: week.end, weekNumber: week.number, isOverride: false });
    picked.forEach((employeeId) => { newLinks.push({ id: nanoid(), allocationId, employeeId }); track(employeeId, "after", week.start); });
    newBumps.push(...planBumps(ctx, allocationId, week.start, picked));
  }

  const ops: BatchItem<"sqlite">[] = [];
  if (staleIds.length) ops.push(db.delete(swapRequests).where(or(inArray(swapRequests.initiatorAllocationId, staleIds), inArray(swapRequests.targetAllocationId, staleIds))), db.delete(swapHistory).where(inArray(swapHistory.allocationId, staleIds)), db.delete(dayBumps).where(inArray(dayBumps.allocationId, staleIds)), db.delete(allocationEmployees).where(inArray(allocationEmployees.allocationId, staleIds)), db.delete(weekAllocations).where(inArray(weekAllocations.id, staleIds)));
  if (newWeeks.length) ops.push(db.insert(weekAllocations).values(newWeeks));
  if (newLinks.length) ops.push(db.insert(allocationEmployees).values(newLinks));
  if (newBumps.length) ops.push(db.insert(dayBumps).values(newBumps));
  await runBatch(ops);

  return [...changes].flatMap(([employeeId, { before, after }]) => {
    const added = [...after].filter((w) => !before.has(w)).sort(), removed = [...before].filter((w) => !after.has(w)).sort();
    return added.length || removed.length ? [{ employeeId, added, removed }] : [];
  });
}

/** Admin "Generate": starts next week on a fresh schedule, else after the current + next week (current + 2). */
export async function generateSchedule(weeksCount = DEFAULT_WEEKS) {
  const current = currentWeekStart();
  const [upcoming] = await db.select({ id: weekAllocations.id }).from(weekAllocations).where(gte(weekAllocations.weekStart, current)).limit(1);
  return generateAllocations(addWeeks(parseISO(current), upcoming ? 2 : 1), weeksCount);
}

/** Settings "Regenerate": discards every week from the current week on (incl. swaps/manual edits) and rebuilds; rotation continues from last week. */
export async function resetSchedule(weeksCount = DEFAULT_WEEKS) {
  const next = parseISO(currentWeekStart());
  const [last] = await db.select({ weekStart: weekAllocations.weekStart }).from(weekAllocations).orderBy(desc(weekAllocations.weekStart)).limit(1);
  const span = last ? differenceInCalendarWeeks(parseISO(last.weekStart), next) + 1 : 0;
  return generateAllocations(next, Math.max(weeksCount, span), { reset: true });
}

export async function notifyScheduleChanges(changes: ScheduleChange[], reason: string) {
  if (!changes.length) return;
  await db.insert(notifications).values(changes.map(({ employeeId, added, removed }) => {
    const list = (days: string[]) => days.slice(0, 3).map(pretty).join(", ") + (days.length > 3 ? ` (+${days.length - 3} more)` : "");
    const parts = [added.length && `WFH added: ${list(added)}`, removed.length && `WFH removed: ${list(removed)}`].filter(Boolean);
    return { id: nanoid(), employeeId, message: `Schedule adjusted (${reason}). ${parts.join(". ")}.` };
  }));
}

/** Re-plans the active schedule after team/seat changes. No-op until an admin has generated a schedule. */
export async function rebalanceSchedule(reason: string) {
  const current = currentWeekStart();
  const [last] = await db.select({ weekStart: weekAllocations.weekStart }).from(weekAllocations).orderBy(desc(weekAllocations.weekStart)).limit(1);
  if (!last || last.weekStart < current) return;
  const weeksCount = Math.max(DEFAULT_WEEKS, differenceInCalendarWeeks(parseISO(last.weekStart), parseISO(current)) + 1);
  await notifyScheduleChanges(await generateAllocations(new Date(), weeksCount), reason);
}

/** After an away span changes: re-plan open weeks, then refresh day bumps on frozen/override weeks inside the span. */
export async function applyAwayChange(fromWeek: string, toWeek: string, reason: string) {
  await rebalanceSchedule(reason);
  const ids = await db.select({ id: weekAllocations.id }).from(weekAllocations).where(and(gte(weekAllocations.weekStart, fromWeek), lte(weekAllocations.weekStart, toWeek)));
  await recomputeBumps(ids.map((r) => r.id));
}

export async function recomputeBumps(allocationIds: string[]) {
  if (!allocationIds.length) return;
  const [ctx, allocs, links] = await Promise.all([
    loadContext(),
    db.select({ id: weekAllocations.id, weekStart: weekAllocations.weekStart }).from(weekAllocations).where(inArray(weekAllocations.id, allocationIds)),
    db.select().from(allocationEmployees).where(inArray(allocationEmployees.allocationId, allocationIds)),
  ]);
  const rows = allocs.flatMap((a) => planBumps(ctx, a.id, a.weekStart, links.filter((l) => l.allocationId === a.id).map((l) => l.employeeId)));
  await runBatch([db.delete(dayBumps).where(inArray(dayBumps.allocationId, allocationIds)), ...(rows.length ? [db.insert(dayBumps).values(rows)] : [])]);
}

export type MemberResult = { ok: true } | { ok: false; status: number; error: string; needsConfirm?: boolean };

/** Admin manual edit: add someone to a week's WFH list, or move them back to office (warns when seats overflow). */
export async function setWeekMember(weekStartInput: string, employeeId: string, action: "add" | "remove", force = false): Promise<MemberResult> {
  const weekStart = toDay(startOfWeek(parseISO(weekStartInput), WEEK_OPTS));
  if (weekStart < currentWeekStart()) return { ok: false, status: 400, error: "Cannot edit past weeks" };

  const ctx = await loadContext();
  const emp = [...ctx.rotating, ...ctx.wfo, ...ctx.permWfh].find((e) => e.id === employeeId);
  if (!emp) return { ok: false, status: 404, error: "Active employee not found" };
  if (emp.wfhType === "permanent_wfh") return { ok: false, status: 400, error: `${emp.name} is always WFH` };
  const away = awayIn(ctx, weekStart);
  if (away.has(employeeId)) return { ok: false, status: 400, error: `${emp.name} is away that week` };

  const [week] = await db.select().from(weekAllocations).where(eq(weekAllocations.weekStart, weekStart)).limit(1);
  const links = week ? await db.select().from(allocationEmployees).where(eq(allocationEmployees.allocationId, week.id)) : [];
  const wfh = new Set(links.map((l) => l.employeeId));

  if (action === "add" && wfh.has(employeeId)) return { ok: false, status: 400, error: `${emp.name} is already WFH that week` };
  if (action === "remove" && !wfh.has(employeeId)) return { ok: false, status: 400, error: `${emp.name} is not WFH that week` };
  if (action === "remove") {
    const office = officeHeadcount(ctx, wfh, away) + 1;
    if (office > ctx.seats && !force) return { ok: false, status: 409, needsConfirm: true, error: `Seats are limited: office will be ${office}/${ctx.seats} that week. Move ${emp.name} anyway?` };
  }

  const allocationId = week?.id ?? nanoid();
  const ops: BatchItem<"sqlite">[] = [];
  if (!week) ops.push(db.insert(weekAllocations).values({ id: allocationId, weekStart, weekEnd: toDay(endOfWeek(parseISO(weekStart), WEEK_OPTS)), weekNumber: (Math.abs(differenceInCalendarWeeks(parseISO(weekStart), parseISO(currentWeekStart()))) % ctx.cycle) + 1, isOverride: true }));
  else ops.push(db.update(weekAllocations).set({ isOverride: true }).where(eq(weekAllocations.id, allocationId)));

  if (action === "add") { ops.push(db.insert(allocationEmployees).values({ id: nanoid(), allocationId, employeeId })); wfh.add(employeeId); }
  else { ops.push(db.delete(allocationEmployees).where(and(eq(allocationEmployees.allocationId, allocationId), eq(allocationEmployees.employeeId, employeeId)))); wfh.delete(employeeId); }

  const bumps = planBumps(ctx, allocationId, weekStart, [...wfh]);
  ops.push(db.delete(dayBumps).where(eq(dayBumps.allocationId, allocationId)));
  if (bumps.length) ops.push(db.insert(dayBumps).values(bumps));
  ops.push(db.insert(notifications).values({ id: nanoid(), employeeId, message: action === "add" ? `Admin assigned you WFH for the week of ${pretty(weekStart)}.` : `Admin moved you to office for the week of ${pretty(weekStart)}.` }));
  await runBatch(ops);
  return { ok: true };
}

export async function getAllocationsForMonth(year: number, month: number): Promise<WeekAllocation[]> {
  const startStr = toDay(startOfWeek(new Date(year, month, 1), WEEK_OPTS));
  const endStr = toDay(endOfWeek(new Date(year, month + 1, 0), WEEK_OPTS));

  const allocations = await db.select().from(weekAllocations).where(and(gte(weekAllocations.weekStart, startStr), lte(weekAllocations.weekStart, endStr))).orderBy(asc(weekAllocations.weekStart));
  if (!allocations.length) return [];

  const ids = allocations.map((a) => a.id);
  const [links, swaps, bumps, allEmps, aways] = await Promise.all([
    db.select().from(allocationEmployees).where(inArray(allocationEmployees.allocationId, ids)),
    db.select().from(swapHistory).where(inArray(swapHistory.allocationId, ids)),
    db.select().from(dayBumps).where(inArray(dayBumps.allocationId, ids)),
    db.select().from(employees),
    db.select().from(employeeAway).where(and(lte(employeeAway.fromWeek, endStr), gte(employeeAway.toWeek, startStr))),
  ]);
  const empById = new Map(allEmps.map((e) => [e.id, { ...e, fixedDays: JSON.parse(e.fixedDays || "[]") } as unknown as Employee]));

  return allocations.map((alloc) => {
    const allocEmps = links.filter((l) => l.allocationId === alloc.id).flatMap((l) => empById.get(l.employeeId) ?? []);
    const swapDetails = swaps.filter((s) => s.allocationId === alloc.id).flatMap((s) => { const from = empById.get(s.fromEmployeeId), to = empById.get(s.toEmployeeId); return from && to ? [{ fromName: from.name, toName: to.name }] : []; });
    const dayBumpDetails = bumps.filter((b) => b.allocationId === alloc.id).flatMap((b) => { const emp = empById.get(b.employeeId); return emp ? [{ date: b.date, employee: emp, forId: b.forEmployeeId ?? undefined, forName: b.forEmployeeId ? empById.get(b.forEmployeeId)?.name : undefined }] : []; });
    const away = aways.filter((a) => a.fromWeek <= alloc.weekStart && alloc.weekStart <= a.toWeek).flatMap((a) => empById.get(a.employeeId) ?? []);
    return { id: alloc.id, weekStart: parseISO(alloc.weekStart), weekEnd: parseISO(alloc.weekEnd), weekNumber: alloc.weekNumber, isOverride: alloc.isOverride, createdAt: alloc.createdAt, employees: allocEmps, swaps: swapDetails, bumps: dayBumpDetails, away };
  });
}

export async function swapEmployees(allocationId1: string, employeeId1: string, allocationId2: string, employeeId2: string): Promise<{ success: boolean; error?: string }> {
  if (employeeId1 === employeeId2) return { success: false, error: "Cannot swap same employee" };

  const [links, weeks] = await Promise.all([
    db.select().from(allocationEmployees).where(inArray(allocationEmployees.allocationId, [allocationId1, allocationId2])),
    db.select({ id: weekAllocations.id, weekStart: weekAllocations.weekStart }).from(weekAllocations).where(inArray(weekAllocations.id, [allocationId1, allocationId2])),
  ]);
  const has = (allocationId: string, employeeId: string) => links.some((l) => l.allocationId === allocationId && l.employeeId === employeeId);
  if (!has(allocationId1, employeeId1) || !has(allocationId2, employeeId2)) return { success: false, error: "Employee is no longer assigned to that week" };
  if (has(allocationId1, employeeId2)) return { success: false, error: "Employee already assigned to this week" };
  if (has(allocationId2, employeeId1)) return { success: false, error: "Employee already assigned to target week" };

  const weekOf = (id: string) => pretty(weeks.find((w) => w.id === id)?.weekStart ?? "");
  await db.batch([
    db.update(allocationEmployees).set({ employeeId: employeeId2 }).where(and(eq(allocationEmployees.allocationId, allocationId1), eq(allocationEmployees.employeeId, employeeId1))),
    db.update(allocationEmployees).set({ employeeId: employeeId1 }).where(and(eq(allocationEmployees.allocationId, allocationId2), eq(allocationEmployees.employeeId, employeeId2))),
    db.update(weekAllocations).set({ isOverride: true }).where(inArray(weekAllocations.id, [allocationId1, allocationId2])),
    db.insert(swapHistory).values([
      { id: nanoid(), allocationId: allocationId1, fromEmployeeId: employeeId1, toEmployeeId: employeeId2 },
      { id: nanoid(), allocationId: allocationId2, fromEmployeeId: employeeId2, toEmployeeId: employeeId1 },
    ]),
    db.insert(notifications).values([
      { id: nanoid(), employeeId: employeeId1, message: `Your WFH week moved from ${weekOf(allocationId1)} to ${weekOf(allocationId2)} (swap).` },
      { id: nanoid(), employeeId: employeeId2, message: `Your WFH week moved from ${weekOf(allocationId2)} to ${weekOf(allocationId1)} (swap).` },
    ]),
  ]);
  await recomputeBumps([allocationId1, allocationId2]);
  return { success: true };
}

export async function clearAllocations(): Promise<void> {
  await db.batch([db.delete(dayBumps), db.delete(swapHistory), db.delete(allocationEmployees), db.delete(weekAllocations)]);
}
