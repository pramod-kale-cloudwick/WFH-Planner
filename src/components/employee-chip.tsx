"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Employee } from "@/types";

interface EmployeeChipProps {
  employee: Employee;
  isSelected?: boolean;
  onClick?: () => void;
  showDesignation?: boolean;
  disabled?: boolean;
}

export function EmployeeChip({ employee, isSelected, onClick, showDesignation, disabled }: EmployeeChipProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-95",
        isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105",
        onClick && !disabled && "hover:bg-accent"
      )}
      onClick={disabled ? undefined : onClick}
    >
      <span>{employee.name}</span>
      {showDesignation && <span className="ml-1 text-muted-foreground text-xs">({employee.designation})</span>}
    </Badge>
  );
}
