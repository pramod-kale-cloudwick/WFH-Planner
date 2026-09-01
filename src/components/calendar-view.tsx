"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isWeekend, isBefore, isSameWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, MessageCircle, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WeekAllocation, Employee, WeekDay, DateAnnotation } from "@/types";

const EMPLOYEE_COLORS = ["bg-blue-500/20 text-blue-300", "bg-green-500/20 text-green-300", "bg-purple-500/20 text-purple-300", "bg-orange-500/20 text-orange-300", "bg-pink-500/20 text-pink-300", "bg-cyan-500/20 text-cyan-300", "bg-yellow-500/20 text-yellow-300", "bg-red-500/20 text-red-300"];

interface CalendarViewProps {
  onSwapComplete?: () => void;
}

export function CalendarView({ onSwapComplete }: CalendarViewProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allocations, setAllocations] = useState<WeekAllocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [annotations, setAnnotations] = useState<DateAnnotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [swapping, setSwapping] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{ allocationId: string; employeeId: string; weekStart: Date } | null>(null);
  const [newAnnotation, setNewAnnotation] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const [allocRes, empRes, annotRes] = await Promise.all([
      fetch(`/api/allocations?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()}`),
      fetch("/api/employees"),
      fetch(`/api/annotations?startDate=${format(calStart, "yyyy-MM-dd")}&endDate=${format(calEnd, "yyyy-MM-dd")}`),
    ]);
    const [allocData, empData, annotData] = await Promise.all([allocRes.json(), empRes.json(), annotRes.json()]);
    setAllocations(allocData.map((a: WeekAllocation) => ({ ...a, weekStart: new Date(a.weekStart), weekEnd: new Date(a.weekEnd) })));
    setEmployees(empData);
    setAnnotations(annotData);
    setLoading(false);
  }, [currentDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const employeeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((emp, idx) => map.set(emp.id, EMPLOYEE_COLORS[idx % EMPLOYEE_COLORS.length]));
    return map;
  }, [employees]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const getWfhEmployeesForDay = useCallback((day: Date): Employee[] => {
    const allocation = allocations.find((a) => isSameWeek(day, a.weekStart, { weekStartsOn: 0 }));
    return allocation?.employees || [];
  }, [allocations]);

  const getAllocationForDay = useCallback((day: Date): WeekAllocation | null => {
    return allocations.find((a) => isSameWeek(day, a.weekStart, { weekStartsOn: 0 })) || null;
  }, [allocations]);

  const getAnnotationsForDay = useCallback((day: Date): DateAnnotation[] => {
    const dateStr = format(day, "yyyy-MM-dd");
    return annotations.filter((a) => a.date === dateStr);
  }, [annotations]);

  const handleAddAnnotation = async (day: Date) => {
    if (!newAnnotation.trim()) return;
    setSavingAnnotation(true);
    try {
      const res = await fetch("/api/annotations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: format(day, "yyyy-MM-dd"), message: newAnnotation.trim() }) });
      if (!res.ok) { toast.error("Failed to add note"); return; }
      const data = await res.json();
      setAnnotations((prev) => [...prev, data]);
      setNewAnnotation("");
      toast.success("Note added");
    } catch { toast.error("Failed to add note"); } finally { setSavingAnnotation(false); }
  };

  const handleDeleteAnnotation = async (id: string) => {
    try {
      const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete note"); return; }
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      toast.success("Note deleted");
    } catch { toast.error("Failed to delete note"); }
  };

  const handleEmployeeClick = async (day: Date, employee: Employee) => {
    if (isWeekend(day)) return;
    const allocation = getAllocationForDay(day);
    if (!allocation) return;

    const today = new Date();
    const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
    const dayWeekStart = startOfWeek(day, { weekStartsOn: 0 });
    if (isBefore(dayWeekStart, currentWeekStart)) return;

    if (!selectedEmployee) {
      setSelectedEmployee({ allocationId: allocation.id, employeeId: employee.id, weekStart: startOfWeek(day, { weekStartsOn: 0 }) });
      toast.info(`Selected ${employee.name}. Click another employee to swap, or same to deselect.`, { id: "swap-hint", duration: Infinity });
      return;
    }
    if (selectedEmployee.allocationId === allocation.id && selectedEmployee.employeeId === employee.id) {
      setSelectedEmployee(null);
      toast.dismiss("swap-hint");
      return;
    }
    if (selectedEmployee.allocationId === allocation.id) {
      setSelectedEmployee({ allocationId: allocation.id, employeeId: employee.id, weekStart: startOfWeek(day, { weekStartsOn: 0 }) });
      toast.info(`Selected ${employee.name}. Click another employee to swap, or same to deselect.`, { id: "swap-hint", duration: Infinity });
      return;
    }

    toast.loading("Swapping...", { id: "swap-hint" });
    setSwapping(true);
    try {
      const res = await fetch("/api/allocations/swap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allocationId1: selectedEmployee.allocationId, employeeId1: selectedEmployee.employeeId, allocationId2: allocation.id, employeeId2: employee.id }) });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Swap failed", { id: "swap-hint" });
        setSelectedEmployee(null);
        return;
      }
      setSelectedEmployee(null);
      await fetchData();
      onSwapComplete?.();
      toast.success("Employees swapped", { id: "swap-hint" });
    } catch {
      toast.error("Swap failed", { id: "swap-hint" });
    } finally {
      setSwapping(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    await fetch("/api/allocations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weeksCount: 20 }) });
    await fetchData();
    toast.success("Schedule generated");
  };

  const today = new Date();
  const rotatingEmployees = employees.filter((e) => e.wfhType === "rotating" && e.isActive);
  const employeesWithFixedDays = employees.filter((e) => e.isActive && e.fixedDays && e.fixedDays.length > 0);
  const getEmployeesByDay = (day: WeekDay) => employeesWithFixedDays.filter((e) => e.fixedDays.includes(day));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="transition-transform duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-semibold min-w-40 text-center">{format(currentDate, "MMMM yyyy")}</h2>
          <Button variant="outline" size="icon" className="transition-transform duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
          {!isSameMonth(currentDate, today) && <Button variant="outline" size="sm" className="ml-2 transition-all duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(new Date())}><CalendarDays className="h-4 w-4 mr-1" />Today</Button>}
        </div>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger disabled={loading} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 hover:scale-105 active:scale-95 bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 disabled:pointer-events-none disabled:opacity-50">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />Generate Schedule
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
        <div className="h-96 bg-card animate-pulse rounded-lg" />
      ) : (
        <div className="border rounded-lg overflow-hidden">
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
              const wfhEmps = getWfhEmployeesForDay(day);
              const allocation = getAllocationForDay(day);
              const currentWeekStart = startOfWeek(today, { weekStartsOn: 0 });
              const dayWeekStart = startOfWeek(day, { weekStartsOn: 0 });
              const isPastWeek = isBefore(dayWeekStart, currentWeekStart);
              const dayAnnotations = getAnnotationsForDay(day);
              const hasAnnotations = dayAnnotations.length > 0;

              return (
                <Popover key={day.toISOString()}>
                  <PopoverTrigger disabled={!isCurrentMonth} className={cn("min-h-24 border-t border-l p-1.5 transition-all duration-200 relative cursor-pointer text-left", !isCurrentMonth && "bg-muted/30 cursor-default", weekend && "bg-muted/20", isToday && "ring-2 ring-primary ring-inset", isCurrentMonth && !weekend && "hover:bg-muted/40 hover:shadow-inner", isCurrentMonth && weekend && "hover:bg-muted/30")}>
                      {hasAnnotations && <MessageCircle className="absolute top-1 right-1 h-3.5 w-3.5 text-yellow-400" fill="currentColor" />}
                      <div className={cn("text-sm font-semibold mb-1", !isCurrentMonth && "text-muted-foreground/50", weekend && "text-muted-foreground/40")}>
                        {format(day, "d")}
                      </div>
                      {!weekend && isCurrentMonth && wfhEmps.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {wfhEmps.map((emp) => {
                            const isSelected = selectedEmployee?.allocationId === allocation?.id && selectedEmployee?.employeeId === emp.id;
                            return (
                              <Badge key={emp.id} variant="secondary" className={cn("text-[10px] px-1.5 py-0 cursor-pointer transition-all duration-150", employeeColorMap.get(emp.id), isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background", isPastWeek && "opacity-50 cursor-not-allowed")} onClick={(e) => { e.stopPropagation(); !isPastWeek && handleEmployeeClick(day, emp); }}>
                                {emp.name}
                              </Badge>
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
                        {dayAnnotations.length > 0 && (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {dayAnnotations.map((ann) => (
                              <div key={ann.id} className="bg-muted/50 rounded-md p-2 text-sm group relative">
                                <p className="pr-5">{ann.message}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">— {ann.authorName}</p>
                                <button onClick={() => handleDeleteAnnotation(ann.id)} className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-destructive transition-all"><X className="h-3 w-3" /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input placeholder="Add a note..." value={newAnnotation} onChange={(e) => setNewAnnotation(e.target.value)} className="h-8 text-sm" onKeyDown={(e) => e.key === "Enter" && handleAddAnnotation(day)} />
                          <Button size="icon" className="h-8 w-8 shrink-0" onClick={() => handleAddAnnotation(day)} disabled={savingAnnotation || !newAnnotation.trim()}>
                            <Send className="h-3 w-3" />
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

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {rotatingEmployees.map((emp) => (
            <Badge key={emp.id} variant="secondary" className={cn("text-[10px] px-1.5 py-0", employeeColorMap.get(emp.id))}>
              {emp.name}
            </Badge>
          ))}
        </div>
        <span>Showing WFH schedule for {format(currentDate, "MMMM yyyy")} (Mon – Fri)</span>
      </div>

      {employeesWithFixedDays.length > 0 && (
        <div className="border-t pt-4 animate-in fade-in duration-500">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">Fixed WFH Days (every week)</h3>
          <div className="flex flex-wrap gap-3">
            {(["monday", "tuesday", "wednesday", "thursday", "friday"] as WeekDay[]).map((day) => {
              const emps = getEmployeesByDay(day);
              if (emps.length === 0) return null;
              return (
                <div key={day} className="flex items-center gap-2 bg-card px-3 py-1.5 rounded-md border transition-all duration-200 hover:border-primary/50">
                  <span className="text-xs font-medium capitalize">{day.slice(0, 3)}:</span>
                  {emps.map((e) => <span key={e.id} className="text-sm">{e.name}</span>)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
