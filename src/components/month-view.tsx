"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks, isSameWeek } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WeekCard } from "./week-card";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { WeekAllocation, Employee, WeekDay } from "@/types";

interface MonthViewProps {
  onSwapComplete?: () => void;
}

interface WeekSlot {
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  allocation: WeekAllocation | null;
}

export function MonthView({ onSwapComplete }: MonthViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [allocations, setAllocations] = useState<WeekAllocation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<{ allocationId: string; employeeId: string } | null>(null);
  const [openWfoWeeks, setOpenWfoWeeks] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [allocRes, empRes] = await Promise.all([
      fetch(`/api/allocations?year=${currentDate.getFullYear()}&month=${currentDate.getMonth()}`),
      fetch("/api/employees"),
    ]);
    const [allocData, empData] = await Promise.all([allocRes.json(), empRes.json()]);
    setAllocations(allocData.map((a: WeekAllocation) => ({ ...a, weekStart: new Date(a.weekStart), weekEnd: new Date(a.weekEnd) })));
    setEmployees(empData);
    setLoading(false);
  }, [currentDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const weekSlots = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const slots: WeekSlot[] = [];
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    if (weekStart.getMonth() !== currentDate.getMonth()) weekStart = addWeeks(weekStart, 1);
    let weekNum = 1;
    while (weekStart <= monthEnd) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const allocation = allocations.find((a) => isSameWeek(a.weekStart, weekStart, { weekStartsOn: 1 })) || null;
      slots.push({ weekStart, weekEnd, weekNumber: weekNum, allocation });
      weekStart = addWeeks(weekStart, 1);
      weekNum++;
    }
    return slots;
  }, [currentDate, allocations]);

  const handleEmployeeClick = async (allocationId: string, employee: Employee) => {
    if (!selectedEmployee) {
      setSelectedEmployee({ allocationId, employeeId: employee.id });
      return;
    }
    if (selectedEmployee.allocationId === allocationId && selectedEmployee.employeeId === employee.id) {
      setSelectedEmployee(null);
      return;
    }
    if (selectedEmployee.allocationId === allocationId) {
      setSelectedEmployee({ allocationId, employeeId: employee.id });
      return;
    }
    try {
      await fetch("/api/allocations/swap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allocationId1: selectedEmployee.allocationId, employeeId1: selectedEmployee.employeeId, allocationId2: allocationId, employeeId2: employee.id }) });
      setSelectedEmployee(null);
      await fetchData();
      onSwapComplete?.();
      toast.success("Employees swapped");
    } catch {
      toast.error("Swap failed");
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    await fetch("/api/allocations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weeksCount: 20 }) });
    await fetchData();
    toast.success("Schedule generated");
  };

  const handleWfoToggle = (weekKey: string) => {
    setOpenWfoWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekKey)) next.delete(weekKey);
      else next.add(weekKey);
      return next;
    });
  };

  const rotatingEmployees = employees.filter((e) => e.wfhType === "rotating" && e.isActive);
  const employeesWithFixedDays = employees.filter((e) => e.isActive && e.fixedDays && e.fixedDays.length > 0);
  const getEmployeesByDay = (day: WeekDay) => employeesWithFixedDays.filter((e) => e.fixedDays.includes(day));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="transition-transform duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(subMonths(currentDate, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <h2 className="text-xl font-semibold min-w-[160px] text-center transition-opacity duration-300">{format(currentDate, "MMMM yyyy")}</h2>
          <Button variant="outline" size="icon" className="transition-transform duration-200 hover:scale-105 active:scale-95" onClick={() => setCurrentDate(addMonths(currentDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button onClick={handleGenerate} disabled={loading} className="transition-all duration-200 hover:scale-105 active:scale-95"><RefreshCw className={`h-4 w-4 mr-2 transition-transform duration-500 ${loading ? "animate-spin" : ""}`} />Generate Schedule</Button>
      </div>

      {selectedEmployee && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg px-4 py-2 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          Click another employee to swap, or click the same one to deselect.
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-48 bg-card animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-start">
          {weekSlots.map((slot) => {
            const weekKey = slot.weekStart.toISOString();
            return (
              <WeekCard
                key={weekKey}
                allocation={slot.allocation}
                weekStart={slot.weekStart}
                weekEnd={slot.weekEnd}
                weekNumber={slot.weekNumber}
                allRotatingEmployees={rotatingEmployees}
                selectedEmployee={selectedEmployee}
                onEmployeeClick={handleEmployeeClick}
                isWfoOpen={openWfoWeeks.has(weekKey)}
                onWfoToggle={() => handleWfoToggle(weekKey)}
              />
            );
          })}
        </div>
      )}

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
