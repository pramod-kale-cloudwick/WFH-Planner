"use client";

import { format, addDays, isBefore, startOfWeek } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmployeeChip } from "./employee-chip";
import { cn } from "@/lib/utils";
import { ChevronDown, ArrowLeftRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WeekAllocation, Employee } from "@/types";

interface WeekCardProps {
  allocation: WeekAllocation | null;
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  allRotatingEmployees: Employee[];
  selectedEmployee: { allocationId: string; employeeId: string; weekStart: Date } | null;
  onEmployeeClick: (allocationId: string, employee: Employee, weekStart: Date) => void;
  isWfoOpen: boolean;
  onWfoToggle: () => void;
}

export function WeekCard({ allocation, weekStart, weekEnd, weekNumber, allRotatingEmployees, selectedEmployee, onEmployeeClick, isWfoOpen, onWfoToggle }: WeekCardProps) {
  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const isCurrentWeek = today >= weekStart && today <= weekEnd;
  const isPastWeek = isBefore(weekStart, currentWeekStart);
  const hasData = allocation !== null;
  const wfhEmployeeIds = hasData ? allocation.employees.map((e) => e.id) : [];
  const wfoEmployees = allRotatingEmployees.filter((e) => !wfhEmployeeIds.includes(e.id));
  const weekFriday = addDays(weekStart, 4);

  return (
    <Card className={cn("transition-all duration-300", isCurrentWeek && "ring-2 ring-primary", hasData && allocation.isOverride && "border-yellow-500/50", !hasData && "opacity-60")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Week {weekNumber}</CardTitle>
          {hasData && allocation.swaps && allocation.swaps.length > 0 && (
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="outline" className="text-xs text-yellow-500 border-yellow-500/50 gap-1">
                  <ArrowLeftRight className="h-3 w-3" />{allocation.swaps.length}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="space-y-1">
                  {allocation.swaps.map((s, i) => (
                    <p key={i} className="text-xs">{s.fromName} ↔ {s.toName}</p>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{format(weekStart, "MMM d")} - {format(weekFriday, "MMM d")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasData ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-2">WFH ({allocation.employees.length})</p>
              <div className="flex flex-wrap gap-2">
                {allocation.employees.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No one assigned</p>
                ) : (
                  allocation.employees.map((emp) => {
                    const isSelected = selectedEmployee?.allocationId === allocation.id && selectedEmployee?.employeeId === emp.id;
                    return <EmployeeChip key={emp.id} employee={emp} isSelected={isSelected} onClick={isPastWeek ? undefined : () => onEmployeeClick(allocation.id, emp, weekStart)} disabled={isPastWeek} />;
                  })
                )}
              </div>
            </div>
            <Collapsible open={isWfoOpen} onOpenChange={onWfoToggle} className="pt-2 border-t">
              <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors duration-200">
                <span>WFO: <span className="font-medium text-foreground">{wfoEmployees.length}</span></span>
                <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", isWfoOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-top-1 data-[state=open]:slide-in-from-top-1 duration-200">
                <div className="flex flex-wrap gap-1 pt-2">
                  {wfoEmployees.map((emp) => (
                    <span key={emp.id} className="text-xs bg-muted px-2 py-0.5 rounded transition-colors duration-150 hover:bg-muted/80">{emp.name}</span>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
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
