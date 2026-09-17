"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { ChevronLeft, ChevronRight, RefreshCw, CalendarDays, MessageCircle, X, Send, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmployees, useAllocations, useAnnotations } from "@/lib/hooks";
import type { WeekAllocation, Employee, WeekDay, DateAnnotation } from "@/types";

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

interface CalendarViewProps {
  onSwapComplete?: () => void;
}

export function CalendarView({ onSwapComplete }: CalendarViewProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const userEmail = session?.user?.email;
  const [currentDate, setCurrentDate] = useState(new Date());

  const { employees, isLoading: empLoading, mutate: mutateEmployees } = useEmployees();
  const { allocations, isLoading: allocLoading, mutate: mutateAllocations } = useAllocations(currentDate.getFullYear(), currentDate.getMonth());

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
    try {
      const res = await fetch(`/api/annotations/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Failed to delete note"); return; }
      mutateAnnotations();
      toast.success("Note deleted");
    } catch { toast.error("Failed to delete note"); }
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
      toast.success(`Swapped ${adminSelectedEmp.employee.name} successfully. Affected employees will be notified.`);
      setAdminSwapDialogOpen(false);
      setAdminSelectedEmp(null);
      setTargetWeekId("");
      setTargetEmployeeId("");
      mutateAllocations();
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

  const handleGenerate = async () => {
    await fetch("/api/allocations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weeksCount: 20 }) });
    mutateAllocations();
    mutateEmployees();
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
        <div className="h-96 bg-card animate-pulse rounded-lg flex items-center justify-center">
          <p className="text-sm text-foreground/70 text-center px-8 italic animate-in fade-in duration-500" key={loadingMsgIndex}>
            {LOADING_MESSAGES[loadingMsgIndex]}
          </p>
        </div>
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
                            const empColor = employeeColorMap.get(emp.id) || "#6366F1";
                            const isSelf = currentUserEmployee?.id === emp.id;
                            const canSwap = (isSelf || isAdmin) && !isPastWeek;
                            return (
                              <Badge key={emp.id} variant="secondary" className={cn("text-[10px] px-1.5 py-0 transition-all duration-150", canSwap && "cursor-pointer hover:ring-2 hover:ring-primary", isPastWeek && "opacity-50", !canSwap && "cursor-default")} style={{ backgroundColor: `${empColor}33`, color: empColor }} onClick={(e) => { e.stopPropagation(); if (canSwap) handleEmployeeClick(day, emp); }}>
                                {emp.name}{canSwap && <ArrowRightLeft className="inline h-2.5 w-2.5 ml-1 opacity-60" />}
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
          {rotatingEmployees.map((emp) => {
            const empColor = employeeColorMap.get(emp.id) || "#6366F1";
            return (
              <Badge key={emp.id} variant="secondary" className="text-[10px] px-1.5 py-0" style={{ backgroundColor: `${empColor}33`, color: empColor }}>
                {emp.name}
              </Badge>
            );
          })}
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
                Week {selectedSelfAllocation?.weekNumber} ({selectedSelfAllocation && format(selectedSelfAllocation.weekStart, "MMM d")} - {selectedSelfAllocation && format(selectedSelfAllocation.weekEnd, "MMM d")})
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select target week</label>
              <Select value={targetWeekId} onValueChange={(v) => { setTargetWeekId(v || ""); setTargetEmployeeId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a week to swap into">
                    {targetWeekId && (() => { const w = futureWeeksForSwap.find((w) => w.id === targetWeekId); return w ? `Week ${w.weekNumber} (${format(w.weekStart, "MMM d")} - ${format(w.weekEnd, "MMM d")})` : ""; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {futureWeeksForSwap.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      Week {w.weekNumber} ({format(w.weekStart, "MMM d")} - {format(w.weekEnd, "MMM d")})
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
                {submittingSwap ? "Sending..." : "Send Request"}
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
                {adminSelectedEmp?.employee.name} — Week {adminSelectedEmp?.allocation.weekNumber} ({adminSelectedEmp && format(adminSelectedEmp.allocation.weekStart, "MMM d")})
              </Badge>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select target week</label>
              <Select value={targetWeekId} onValueChange={(v) => { setTargetWeekId(v || ""); setTargetEmployeeId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a week">
                    {targetWeekId && (() => { const w = futureWeeksForSwap.find((w) => w.id === targetWeekId); return w ? `Week ${w.weekNumber} (${format(w.weekStart, "MMM d")} - ${format(w.weekEnd, "MMM d")})` : ""; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {futureWeeksForSwap.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      Week {w.weekNumber} ({format(w.weekStart, "MMM d")} - {format(w.weekEnd, "MMM d")})
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
              <Button variant="outline" onClick={() => setAdminSwapDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAdminDirectSwap} disabled={submittingSwap || !targetWeekId || !targetEmployeeId}>
                {submittingSwap ? "Swapping..." : "Swap Now"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
