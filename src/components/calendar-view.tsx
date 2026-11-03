"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWeekend, isBefore, isSameWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, MessageCircle, X, Send, Loader2, House, Repeat, Pin, Building2, Plane, type LucideIcon } from "lucide-react";
import { cn, workWeek } from "@/lib/utils";
import { fixedDayKind, WEEKDAY_LIST } from "@/lib/employee-validation";
import { useEmployees, useAllocations, useAnnotations, useCalendarMode, useSettings, useAway } from "@/lib/hooks";
import { awaySpan } from "@/components/away-dialog";
import type { WeekAllocation, Employee, WeekDay, DateAnnotation, DayBump, WfhType } from "@/types";

const DEFAULT_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F97316", "#EC4899", "#06B6D4", "#EAB308", "#EF4444", "#6366F1", "#14B8A6", "#F59E0B", "#84CC16"];

const LOADING_MESSAGES = [
  "Free tier vibes — our servers are powered by hopes, dreams, and zero budget.",
  "Patience, grasshopper. Free hosting means our hamsters need coffee breaks.",
  "Loading at the speed of free tier. Good things come to those who wait (and don't pay).",
  "Our servers run on free credits and good intentions. Almost there...",
  "Budget hosting moment — pretend it's 2005 dial-up for the nostalgia.",
  "Fun fact: you're awesome. Also, our servers are waking up from a nap.",
  "Plot twist: the loading screen is the friends we made along the way.",
  "Roses are red, servers are slow, free tier limits? That's how it goes.",
  "You're doing great today. Our database? Not so much. Hang tight.",
  "Remember: you chose WFH life, and WFH life chose you. Loading...",
  "Pro tip: grab a coffee. By the time you're back, we might be done.",
  "You're literally the reason this app exists. Thanks for being patient!",
  "Somewhere, a free-tier server just woke up and chose to serve you.",
  "Your patience level: legendary. Our server speed: questionable.",
  "Take a deep breath. You've handled worse Mondays than this loading screen.",
  "You're crushing it this week. Just like we're crushing these free CPU limits.",
];

const BADGE_KINDS = {
  week: { Icon: Repeat, short: "Rotation WFH week", hint: "Rotating · WFH week (home all week)" },
  fixed: { Icon: Pin, short: "Rotating · fixed WFH day", hint: "Rotating · fixed WFH day on an office week" },
  wfh: { Icon: House, short: "Permanent WFH", hint: "Permanent WFH · in office only on fixed office days" },
  wfo: { Icon: Building2, short: "Permanent WFO · fixed WFH day", hint: "Permanent WFO · fixed WFH day" },
} as const;
const badgeKind = (emp: Employee, inWeek: boolean): keyof typeof BADGE_KINDS => (inWeek ? "week" : emp.wfhType === "permanent_wfh" ? "wfh" : emp.wfhType === "permanent_wfo" ? "wfo" : "fixed");
const OFFICE_KINDS: Record<WfhType, { Icon: LucideIcon; short: string; hint: string }> = {
  rotating: { Icon: Repeat, short: "Rotating · office week", hint: "Rotating · in office this week" },
  permanent_wfh: { Icon: House, short: "Permanent WFH · fixed office day", hint: "Permanent WFH · in office on their fixed office day" },
  permanent_wfo: { Icon: Building2, short: "Permanent WFO", hint: "Permanent WFO · in office" },
};
type DayBadge = { key: string; emp: Employee; Icon?: LucideIcon; hint: string; dashed?: boolean; suffix?: string; inWeek: boolean };

function Hint({ text, children }: { text: string; children: ReactNode }) {
  return <Tooltip><TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger><TooltipContent>{text}</TooltipContent></Tooltip>;
}

interface CalendarViewProps {
  onSwapComplete?: () => void;
}

export function CalendarView({ onSwapComplete }: CalendarViewProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const userEmail = session?.user?.email;
  const [currentDate, setCurrentDate] = useState(new Date());

  const { employees, isLoading: empLoading, mutate: mutateEmployees } = useEmployees();
  const [calendarMode] = useCalendarMode();
  const { settings } = useSettings();
  const { allocations, isLoading: allocLoading, mutate: mutateAllocations } = useAllocations(currentDate.getFullYear(), currentDate.getMonth());
  const { away: awayPeriods } = useAway();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const { annotations, mutate: mutateAnnotations } = useAnnotations(format(calStart, "yyyy-MM-dd"), format(calEnd, "yyyy-MM-dd"));

  const loading = empLoading || allocLoading;

  const [newAnnotation, setNewAnnotation] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Swap request state
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const [selectedSelfAllocation, setSelectedSelfAllocation] = useState<WeekAllocation | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [targetWeekId, setTargetWeekId] = useState<string>("");
  const [targetEmployeeId, setTargetEmployeeId] = useState<string>("");
  const [submittingSwap, setSubmittingSwap] = useState(false);

  // Admin direct swap state
  const [adminSwapDialogOpen, setAdminSwapDialogOpen] = useState(false);
  const [adminSelectedEmp, setAdminSelectedEmp] = useState<{ employee: Employee; allocation: WeekAllocation } | null>(null);
  const [assignEmpId, setAssignEmpId] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Get current user's employee record
  const currentUserEmployee = useMemo(() => employees.find((e) => e.email === userEmail), [employees, userEmail]);

  useEffect(() => {
    const last = parseInt(localStorage.getItem("loadingMsgIndex") || "-1", 10);
    setLoadingMsgIndex((last + 1) % LOADING_MESSAGES.length);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!loading || !hydrated) return;
    localStorage.setItem("loadingMsgIndex", String(loadingMsgIndex));
    const interval = setInterval(() => setLoadingMsgIndex((i) => { const next = (i + 1) % LOADING_MESSAGES.length; localStorage.setItem("loadingMsgIndex", String(next)); return next; }), 3000);
    return () => clearInterval(interval);
  }, [loading, hydrated, loadingMsgIndex]);

  const employeeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((emp, idx) => {
      map.set(emp.id, emp.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]);
    });
    return map;
  }, [employees]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const activeEmployees = useMemo(() => employees.filter((e) => e.isActive), [employees]);

  // WFH-week people are home all week; permanent WFH is home except fixed office days; everyone else is home on fixed WFH days; bumped employees take a WFH slot
  const getWfhForDay = useCallback((day: Date): { wfh: Employee[]; bumped: DayBump[] } => {
    const allocation = allocations.find((a) => isSameWeek(day, a.weekStart, { weekStartsOn: 0 }));
    if (!allocation) return { wfh: [], bumped: [] };
    const weekDay = format(day, "EEEE").toLowerCase() as WeekDay, dateStr = format(day, "yyyy-MM-dd"), inWeek = new Set([...allocation.employees, ...(allocation.away ?? [])].map((e) => e.id));
    const fixedHome = activeEmployees.filter((e) => !inWeek.has(e.id) && (fixedDayKind(e.wfhType) === "office") !== !!e.fixedDays?.includes(weekDay));
    return { wfh: [...allocation.employees, ...fixedHome], bumped: allocation.bumps?.filter((b) => b.date === dateStr) ?? [] };
  }, [allocations, activeEmployees]);

  // Office view = active employees minus everyone home that day (incl. bumped); whoever got a bumped seat is drawn dashed
  const getBadgesForDay = useCallback((day: Date): DayBadge[] => {
    const allocation = allocations.find((a) => isSameWeek(day, a.weekStart, { weekStartsOn: 0 }));
    if (!allocation) return [];
    const { wfh, bumped } = getWfhForDay(day), inWeek = new Set(allocation.employees.map((e) => e.id)), away = allocation.away ?? [];
    if (calendarMode === "wfh") return [
      ...wfh.map((emp) => { const { Icon, hint } = BADGE_KINDS[badgeKind(emp, inWeek.has(emp.id))]; return { key: emp.id, emp, Icon, hint, inWeek: inWeek.has(emp.id) }; }),
      ...bumped.map((b) => ({ key: `bump-${b.employee.id}`, emp: b.employee, hint: b.forName ? `In office this week · stays home today so ${b.forName} can use their fixed office day` : "In office this week · stays home today to free a seat", dashed: true, suffix: " · 1d", inWeek: false })),
    ];
    const home = new Set([...wfh, ...away, ...bumped.map((b) => b.employee)].map((e) => e.id)), seatFrom = new Map(bumped.flatMap((b) => (b.forId ? [[b.forId, b.employee.name] as const] : [])));
    return activeEmployees.filter((e) => !home.has(e.id)).map((emp) => {
      const { Icon, hint } = OFFICE_KINDS[emp.wfhType], from = seatFrom.get(emp.id);
      return { key: emp.id, emp, Icon, hint: from ? `${hint} · using ${from}'s seat (${from} is WFH today)` : hint, dashed: !!from, inWeek: false };
    });
  }, [allocations, activeEmployees, getWfhForDay, calendarMode]);

  const getAssignable = useCallback((allocation: WeekAllocation | null) => employees.filter((e) => e.isActive && e.wfhType !== "permanent_wfh" && ![...(allocation?.employees ?? []), ...(allocation?.away ?? [])].some((a) => a.id === e.id)), [employees]);

  const getAllocationForDay = useCallback((day: Date): WeekAllocation | null => {
    return allocations.find((a) => isSameWeek(day, a.weekStart, { weekStartsOn: 0 })) || null;
  }, [allocations]);

  const getAnnotationsForDay = useCallback((day: Date): DateAnnotation[] => {
    const dateStr = format(day, "yyyy-MM-dd");
    return annotations.filter((a) => a.date === dateStr);
  }, [annotations]);

  // Get weeks where current user is assigned (for swap initiation)
  const userAllocatedWeeks = useMemo(() => {
    if (!currentUserEmployee) return [];
    return allocations.filter((a) => a.employees.some((e) => e.id === currentUserEmployee.id));
  }, [allocations, currentUserEmployee]);

  // Get future weeks for target selection (excluding selected employee's week)
  const futureWeeksForSwap = useMemo(() => {
    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const selectedAllocationId = isAdmin ? adminSelectedEmp?.allocation.id : selectedSelfAllocation?.id;
    return allocations.filter((a) => !isBefore(a.weekStart, currentWeekStart) && a.id !== selectedAllocationId);
  }, [allocations, isAdmin, adminSelectedEmp, selectedSelfAllocation]);

  // Employees in selected target week
  const targetWeekEmployees = useMemo(() => {
    if (!targetWeekId) return [];
    const week = allocations.find((a) => a.id === targetWeekId);
    return week?.employees || [];
  }, [targetWeekId, allocations]);

  const handleAddAnnotation = async (day: Date) => {
    if (!newAnnotation.trim()) return;
    setSavingAnnotation(true);
    try {
      const res = await fetch("/api/annotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: format(day, "yyyy-MM-dd"), message: newAnnotation.trim() }) });
      if (!res.ok) { toast.error("Failed to add note"); return; }
      mutateAnnotations();
      setNewAnnotation("");
      toast.success("Note added");
    } catch { toast.error("Failed to add note"); } finally { setSavingAnnotation(false); }
  };

  const handleDeleteAnnotation = async (id: string) => {
    setPending(`note:${id}`);
    try {
      const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete note"); return; }
      await mutateAnnotations();
      toast.success("Note deleted");
    } catch { toast.error("Failed to delete note"); } finally { setPending(null); }
  };

  const handleEmployeeClick = (day: Date, employee: Employee) => {
    const allocation = getAllocationForDay(day);
    if (!allocation) return;

    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const dayWeekStart = startOfWeek(day, { weekStartsOn: 0 });
    if (isBefore(dayWeekStart, currentWeekStart)) {
      toast.error("Cannot swap past weeks");
      return;
    }

    if (isAdmin) {
      // Admin can swap anyone directly
      setAdminSelectedEmp({ employee, allocation });
      setTargetWeekId("");
      setTargetEmployeeId("");
      setAdminSwapDialogOpen(true);
    } else {
      // Regular users can only swap themselves
      if (!currentUserEmployee || employee.id !== currentUserEmployee.id) {
        toast.error("You can only initiate swaps for yourself");
        return;
      }
      setSelectedSelfAllocation(allocation);
      setSelectedEmployee(employee);
      setTargetWeekId("");
      setTargetEmployeeId("");
      setSwapDialogOpen(true);
    }
  };

  // Admin direct swap handler
  const handleAdminDirectSwap = async () => {
    if (!adminSelectedEmp || !targetWeekId || !targetEmployeeId) {
      toast.error("Please select a week and employee to swap with");
      return;
    }

    setSubmittingSwap(true);
    try {
      const res = await fetch("/api/allocations/swap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allocationId1: adminSelectedEmp.allocation.id, employeeId1: adminSelectedEmp.employee.id, allocationId2: targetWeekId, employeeId2: targetEmployeeId }) });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Swap failed");
        return;
      }
      await mutateAllocations();
      toast.success(`Swapped ${adminSelectedEmp.employee.name} successfully. Affected employees will be notified.`);
      setAdminSwapDialogOpen(false);
      setAdminSelectedEmp(null);
      setTargetWeekId("");
      setTargetEmployeeId("");
      onSwapComplete?.();
    } catch {
      toast.error("Swap failed");
    } finally {
      setSubmittingSwap(false);
    }
  };

  const handleSubmitSwapRequest = async () => {
    if (!selectedSelfAllocation || !targetWeekId || !targetEmployeeId) {
      toast.error("Please select a week and employee to swap with");
      return;
    }

    setSubmittingSwap(true);
    try {
      const res = await fetch("/api/swap-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: targetEmployeeId, initiatorAllocationId: selectedSelfAllocation.id, targetAllocationId: targetWeekId }) });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create swap request");
        return;
      }
      toast.success("Swap request sent! Waiting for target approval.");
      setSwapDialogOpen(false);
      setSelectedSelfAllocation(null);
      setTargetWeekId("");
      setTargetEmployeeId("");
      onSwapComplete?.();
    } catch {
      toast.error("Failed to create swap request");
    } finally {
      setSubmittingSwap(false);
    }
  };

  const handleMember = async (day: Date, employee: Employee, action: "add" | "remove", force = false) => {
    const weekStart = startOfWeek(day, { weekStartsOn: 0 });
    setPending(action);
    try {
      const res = await fetch("/api/allocations/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weekStart: format(weekStart, "yyyy-MM-dd"), employeeId: employee.id, action, force }) });
      const data = await res.json();
      if (res.status === 409 && data.needsConfirm) { toast.warning(data.error, { duration: 10000, action: { label: "Move anyway", onClick: () => handleMember(day, employee, action, true) } }); return; }
      if (!res.ok) { toast.error(data.error || "Failed to update week"); return; }
      await mutateAllocations();
      toast.success(`${employee.name} ${action === "add" ? "set to WFH" : "moved to office"} for ${workWeek(weekStart).label}`);
      setAdminSwapDialogOpen(false);
      setAssignEmpId("");
    } catch { toast.error("Failed to update week"); } finally { setPending(null); }
  };

  const handleGenerate = async () => {
    setPending("generate");
    try {
      const res = await fetch("/api/allocations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weeksCount: 20 }) });
      if (!res.ok) { toast.error("Failed to generate schedule"); return; }
      await Promise.all([mutateAllocations(), mutateEmployees()]);
      toast.success("Schedule generated");
    } catch { toast.error("Failed to generate schedule"); } finally { setPending(null); }
  };
  const busy = submittingSwap || pending === "add" || pending === "remove";

  const today = new Date();
  const rotatingEmployees = employees.filter((e) => e.wfhType === "rotating" && e.isActive);
  const employeesWithFixedDays = employees.filter((e) => e.isActive && e.fixedDays && e.fixedDays.length > 0);
  const getEmployeesByDay = (day: WeekDay) => employeesWithFixedDays.filter((e) => e.fixedDays.includes(day));
  const [viewFrom, viewTo] = [format(calStart, "yyyy-MM-dd"), format(calEnd, "yyyy-MM-dd")];
  const awayThisMonth = awayPeriods.flatMap((p) => { const emp = employees.find((e) => e.id === p.employeeId); return emp && p.fromWeek <= viewTo && p.toWeek >= viewFrom ? [{ ...p, emp }] : []; });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div data-tour="month-nav" className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="transition-transform duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-semibold min-w-40 text-center">{format(currentDate, "MMMM yyyy")}</h2>
          <Button variant="outline" size="icon" className="transition-transform duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
          {!isSameMonth(currentDate, today) && <Button variant="outline" size="sm" className="ml-2 transition-all duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(new Date())}><CalendarDays className="h-4 w-4 mr-1" />Today</Button>}
        </div>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger data-tour="generate" disabled={loading || pending === "generate"} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 disabled:pointer-events-none disabled:opacity-50">
              <RefreshCw className={cn("h-4 w-4", (loading || pending === "generate") && "animate-spin")} />{pending === "generate" ? "Generating..." : "Generate Schedule"}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Generate new schedule?</AlertDialogTitle>
                <AlertDialogDescription>This will create WFH allocations for upcoming weeks. Existing future allocations may be affected.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleGenerate}>Generate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {loading ? (
        <div className="h-96 bg-card animate-pulse rounded-lg flex items-center justify-center">
          <p className="text-sm text-foreground/70 text-center px-8 italic animate-in fade-in duration-500" key={loadingMsgIndex}>
            {LOADING_MESSAGES[loadingMsgIndex]}
          </p>
        </div>
      ) : (
        <div data-tour="calendar-grid" className="border border-foreground/15 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-muted/50">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
              <div key={day} className={cn("px-2 py-3 text-center text-xs font-medium uppercase tracking-wide", (i === 0 || i === 6) && "text-muted-foreground/50")}>
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);
              const weekend = isWeekend(day);
              const badges = getBadgesForDay(day);
              const allocation = getAllocationForDay(day);
              const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
              const dayWeekStart = startOfWeek(day, { weekStartsOn: 0 });
              const isPastWeek = isBefore(dayWeekStart, currentWeekStart);
              const dayAnnotations = getAnnotationsForDay(day);
              const hasAnnotations = dayAnnotations.length > 0;

              return (
                <Popover key={day.toISOString()}>
                  <PopoverTrigger disabled={!isCurrentMonth} className={cn("min-h-24 border-t border-l border-foreground/15 p-1.5 transition-all duration-200 relative cursor-pointer text-left", !isCurrentMonth && "bg-muted/30 cursor-default", weekend && "bg-muted/20", isToday && "ring-2 ring-primary ring-inset", isCurrentMonth && !weekend && "hover:bg-muted/40 hover:shadow-inner", isCurrentMonth && weekend && "hover:bg-muted/30")}>
                      {hasAnnotations && <MessageCircle className="absolute top-1 right-1 h-3.5 w-3.5 text-yellow-400" fill="currentColor" />}
                      <div className={cn("flex items-baseline gap-1.5 text-sm font-semibold mb-1", !isCurrentMonth && "text-muted-foreground/50", weekend && "text-muted-foreground/40")}>
                        {format(day, "d")}
                        {calendarMode === "office" && !weekend && isCurrentMonth && allocation && settings && <span className={cn("text-[10px] font-normal", badges.length > settings.availableSeats ? "text-destructive" : "text-muted-foreground")}>{badges.length}/{settings.availableSeats} seats</span>}
                      </div>
                      {!weekend && isCurrentMonth && badges.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {badges.map(({ key, emp, Icon, hint, dashed, suffix, inWeek }) => {
                            const empColor = employeeColorMap.get(emp.id) || "#6366F1";
                            const canSwap = calendarMode === "wfh" && inWeek && (currentUserEmployee?.id === emp.id || isAdmin) && !isPastWeek;
                            return (
                              <Hint key={key} text={canSwap ? `${hint} · click to swap` : hint}>
                                <Badge variant={dashed ? "outline" : "secondary"} className={cn("text-[10px] px-1.5 py-0 transition-all duration-150", dashed && "border-dashed", canSwap ? "cursor-pointer hover:ring-2 hover:ring-primary" : "cursor-default", isPastWeek && "opacity-50", focusId && (focusId === emp.id ? "ring-2 ring-offset-1 ring-offset-background scale-105 opacity-100" : "opacity-20"))} style={{ ...(dashed ? { borderColor: empColor } : { backgroundColor: `${empColor}33` }), color: empColor, ...(focusId === emp.id && { ["--tw-ring-color" as string]: empColor }) }} onClick={(e) => { e.stopPropagation(); if (canSwap) handleEmployeeClick(day, emp); }}>
                                  {Icon && <Icon className="inline h-2.5 w-2.5 opacity-70" />}{emp.name}{suffix}
                                </Badge>
                              </Hint>
                            );
                          })}
                        </div>
                      )}
                  </PopoverTrigger>
                  {isCurrentMonth && (
                    <PopoverContent className="w-72 p-3" align="start">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{format(day, "MMM d, yyyy")}</span>
                          <Badge variant="outline" className="text-[10px]">{dayAnnotations.length} note{dayAnnotations.length !== 1 ? "s" : ""}</Badge>
                        </div>
                        {isAdmin && !isPastWeek && !weekend && (
                          <div className="space-y-2 border-b pb-3">
                            <p className="text-xs font-medium text-muted-foreground">Assign WFH for week of {format(dayWeekStart, "MMM d")}</p>
                            <div className="flex gap-2">
                              <Select value={assignEmpId} onValueChange={(v) => setAssignEmpId(v || "")}>
                                <SelectTrigger className="h-8 text-sm flex-1">
                                  <SelectValue placeholder="Choose employee">{assignEmpId && employees.find((e) => e.id === assignEmpId)?.name}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {getAssignable(allocation).map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button size="sm" className="h-8" disabled={!assignEmpId || pending === "add"} onClick={() => { const emp = employees.find((e) => e.id === assignEmpId); if (emp) handleMember(day, emp, "add"); }}>{pending === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}</Button>
                            </div>
                          </div>
                        )}
                        {dayAnnotations.length > 0 && (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {dayAnnotations.map((ann) => (
                              <div key={ann.id} className="bg-muted/50 rounded-md p-2 text-sm group relative">
                                <p className="pr-5">{ann.message}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">— {ann.authorName}</p>
                                <button onClick={() => handleDeleteAnnotation(ann.id)} disabled={pending === `note:${ann.id}`} className={cn("absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-all", pending === `note:${ann.id}` && "opacity-100")}>{pending === `note:${ann.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input placeholder="Add a note..." value={newAnnotation} onChange={(e) => setNewAnnotation(e.target.value)} className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleAddAnnotation(day)} />
                          <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handleAddAnnotation(day)} disabled={savingAnnotation || !newAnnotation.trim()}>
                            {savingAnnotation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  )}
                </Popover>
              );
            })}
          </div>
        </div>
      )}

      <div data-tour="icon-key" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {Object.values(calendarMode === "wfh" ? BADGE_KINDS : OFFICE_KINDS).map(({ Icon, short }) => <span key={short} className="inline-flex items-center gap-1"><Icon className="h-3 w-3" />{short}</span>)}
        {calendarMode === "wfh"
          ? <span className="inline-flex items-center gap-1"><span className="rounded-full border border-dashed border-muted-foreground px-1.5 text-[10px]">Name · 1d</span>Gave up seat for the day</span>
          : <span className="inline-flex items-center gap-1"><span className="rounded-full border border-dashed border-muted-foreground px-1.5 text-[10px]">Name</span>Using a seat freed by a 1-day WFH</span>}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div data-tour="legend" className="flex flex-wrap items-center gap-2">
          {rotatingEmployees.map((emp) => {
            const empColor = employeeColorMap.get(emp.id) || "#6366F1";
            return (
              <button key={emp.id} type="button" aria-pressed={focusId === emp.id} title={focusId === emp.id ? "Click to clear highlight" : `Highlight ${emp.name} in calendar`} onClick={() => setFocusId((id) => (id === emp.id ? null : emp.id))}>
                <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0 cursor-pointer transition-all duration-150 hover:scale-105", focusId && (focusId === emp.id ? "ring-2 ring-offset-1 ring-offset-background" : "opacity-40"))} style={{ backgroundColor: `${empColor}33`, color: empColor, ["--tw-ring-color" as string]: empColor }}>
                  {emp.name}
                </Badge>
              </button>
            );
          })}
        </div>
        <span>Showing {calendarMode === "wfh" ? "who's WFH" : "who's in office"} for {format(currentDate, "MMMM yyyy")} (Mon – Fri) · switch from the profile menu</span>
      </div>

      {awayThisMonth.length > 0 && (
        <div data-tour="away" className="border-t pt-4 animate-in fade-in duration-500">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">Away (not counted in office seats)</h3>
          <div className="flex flex-wrap gap-3">
            {awayThisMonth.map((p) => (
              <div key={p.id} className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-md border transition-all duration-200 hover:border-primary/50">
                <Plane className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-sm" style={{ color: employeeColorMap.get(p.emp.id) }}>{p.emp.name}</span>
                <span className="text-xs text-muted-foreground">{awaySpan(p)}{p.reason && ` · ${p.reason}`}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {employeesWithFixedDays.length > 0 && (
        <div data-tour="fixed-days" className="border-t pt-4 space-y-3 animate-in fade-in duration-500">
          {([["office", "Fixed Office Days (every week, Permanent WFH)"], ["wfh", "Fixed WFH Days (every week)"]] as const).map(([kind, title]) => {
            const groups = WEEKDAY_LIST.map((day) => ({ day, emps: getEmployeesByDay(day).filter((e) => fixedDayKind(e.wfhType) === kind) })).filter((g) => g.emps.length);
            return groups.length > 0 && (
              <div key={kind}>
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">{title}</h3>
                <div className="flex flex-wrap gap-3">
                  {groups.map(({ day, emps }) => (
                    <div key={day} className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-md border transition-all duration-200 hover:border-primary/50">
                      <span className="text-xs font-medium capitalize">{day.slice(0, 3)}:</span>
                      {emps.map((e) => <span key={e.id} className="text-sm">{e.name}</span>)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Swap Request Dialog */}
      <Dialog open={swapDialogOpen} onOpenChange={setSwapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Week Swap</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Your current week:</p>
              <Badge variant="outline" className="text-sm">
                {selectedSelfAllocation && workWeek(selectedSelfAllocation.weekStart).label}
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select target week</label>
              <Select value={targetWeekId} onValueChange={(v) => { setTargetWeekId(v || ""); setTargetEmployeeId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a week to swap into">
                    {targetWeekId && (() => { const w = futureWeeksForSwap.find((w) => w.id === targetWeekId); return w ? workWeek(w.weekStart).label : ""; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {futureWeeksForSwap.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {workWeek(w.weekStart).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetWeekId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select employee to swap with</label>
                <Select value={targetEmployeeId} onValueChange={(v) => setTargetEmployeeId(v || "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose an employee">
                      {targetEmployeeId && (() => { const e = targetWeekEmployees.find((e) => e.id === targetEmployeeId); return e?.name || ""; })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {targetWeekEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSwapDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmitSwapRequest} disabled={submittingSwap || !targetWeekId || !targetEmployeeId}>
                {submittingSwap && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{submittingSwap ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Direct Swap Dialog */}
      <Dialog open={adminSwapDialogOpen} onOpenChange={setAdminSwapDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Swap (Direct)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Swapping:</p>
              <Badge variant="outline" className="text-sm">
                {adminSelectedEmp?.employee.name} — {adminSelectedEmp && workWeek(adminSelectedEmp.allocation.weekStart).label}
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select target week</label>
              <Select value={targetWeekId} onValueChange={(v) => { setTargetWeekId(v || ""); setTargetEmployeeId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a week">
                    {targetWeekId && (() => { const w = futureWeeksForSwap.find((w) => w.id === targetWeekId); return w ? workWeek(w.weekStart).label : ""; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {futureWeeksForSwap.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {workWeek(w.weekStart).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {targetWeekId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Swap with</label>
                <Select value={targetEmployeeId} onValueChange={(v) => setTargetEmployeeId(v || "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose an employee">
                      {targetEmployeeId && (() => { const e = targetWeekEmployees.find((e) => e.id === targetEmployeeId); return e?.name || ""; })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {targetWeekEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <p className="text-xs text-muted-foreground">This swap will be executed immediately. Both employees will be notified.</p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="destructive" className="mr-auto" disabled={busy} onClick={() => adminSelectedEmp && handleMember(adminSelectedEmp.allocation.weekStart, adminSelectedEmp.employee, "remove")}>
                {pending === "remove" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{pending === "remove" ? "Moving..." : "Move to office"}
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setAdminSwapDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAdminDirectSwap} disabled={busy || !targetWeekId || !targetEmployeeId}>
                {submittingSwap && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{submittingSwap ? "Swapping..." : "Swap Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
