"use client";

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmployeeChip } from "./employee-chip";
import { cn } from "@/lib/utils";
import type { WeekAllocation, Employee } from "@/types";

interface WeekCardProps {
  allocation: WeekAllocation | null;
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  totalEmployees: number;
  selectedEmployee: { allocationId: string; employeeId: string } | null;
  onEmployeeClick: (allocationId: string, employee: Employee) => void;
}

export function WeekCard({ allocation, weekStart, weekEnd, weekNumber, totalEmployees, selectedEmployee, onEmployeeClick }: WeekCardProps) {
  const isCurrentWeek = new Date() >= weekStart && new Date() <= weekEnd;
  const hasData = allocation !== null;
  const wfhCount = hasData ? allocation.employees.length : 0;
  const wfoCount = totalEmployees - wfhCount;

  return (
    <Card className={cn("h-full transition-all", isCurrentWeek && "ring-2 ring-primary", hasData && allocation.isOverride && "border-yellow-500/50", !hasData && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Week {weekNumber}</CardTitle>
          {hasData && allocation.isOverride && <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/50">Modified</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasData ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-2">WFH ({wfhCount})</p>
              <div className="flex flex-wrap gap-2">
                {allocation.employees.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No one assigned</p>
                ) : (
                  allocation.employees.map((emp) => (
                    <EmployeeChip key={emp.id} employee={emp} isSelected={selectedEmployee?.allocationId === allocation.id && selectedEmployee?.employeeId === emp.id} onClick={() => onEmployeeClick(allocation.id, emp)} />
                  ))
                )}
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">WFO: <span className="font-medium text-foreground">{wfoCount}</span></p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-16">
            <p className="text-xs text-muted-foreground italic">No schedule</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
