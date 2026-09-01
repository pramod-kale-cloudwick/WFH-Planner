"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, X } from "lucide-react";
import type { WfhType, WeekDay } from "@/types";

const WEEKDAYS: { value: WeekDay; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
];

interface EmployeeFormProps {
  onSuccess: () => void;
  initialData?: { id: string; name: string; email?: string; designation: string; wfhType: WfhType; fixedDays: WeekDay[] };
  mode?: "button" | "inline";
  isSelfEdit?: boolean;
}

export function EmployeeForm({ onSuccess, initialData, mode = "button", isSelfEdit = false }: EmployeeFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(initialData?.name || "");
  const [email, setEmail] = useState(initialData?.email || "");
  const [designation, setDesignation] = useState(initialData?.designation || "");
  const [wfhType, setWfhType] = useState<WfhType>(initialData?.wfhType || "rotating");
  const [fixedDays, setFixedDays] = useState<WeekDay[]>(initialData?.fixedDays || []);

  const resetForm = () => {
    if (!initialData) { setName(""); setEmail(""); setDesignation(""); setWfhType("rotating"); setFixedDays([]); }
  };

  const toggleDay = (day: WeekDay) => {
    setFixedDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = initialData ? `/api/employees/${initialData.id}` : "/api/employees";
      const method = initialData ? "PUT" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, designation, wfhType, fixedDays }) });
      onSuccess();
      setOpen(false);
      resetForm();
      toast.success(initialData ? "Employee updated" : "Employee added");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger
        className={mode === "inline"
          ? "flex items-center gap-2 px-2 py-1.5 text-sm w-full rounded-md hover:bg-accent transition-all duration-200 cursor-pointer active:scale-95"
          : "inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-all duration-200 hover:scale-105 active:scale-95"
        }
      >
        {initialData ? (
          <><Pencil className="h-4 w-4" />{isSelfEdit ? "Edit Profile" : "Edit"}</>
        ) : (
          <><Plus className="h-4 w-4" />Add Employee</>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? (isSelfEdit ? "Edit Your Profile" : "Edit Employee") : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
          </div>
          {!isSelfEdit && (
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-muted-foreground text-xs">(for login matching)</span></Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Software Engineer" required />
          </div>
          <div className="space-y-2">
            <Label>WFH Type</Label>
            <Select value={wfhType} onValueChange={(v) => setWfhType(v as WfhType)}>
              <SelectTrigger>
                <SelectValue>
                  {wfhType === "rotating" && "Rotating"}
                  {wfhType === "permanent_wfh" && "Permanent WFH"}
                  {wfhType === "permanent_wfo" && "Permanent WFO"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-[280px]">
                <SelectItem value="rotating">Rotating</SelectItem>
                <SelectItem value="permanent_wfh">Permanent WFH</SelectItem>
                <SelectItem value="permanent_wfo">Permanent WFO</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {wfhType === "rotating" && "Full week WFH on rotation turn"}
              {wfhType === "permanent_wfh" && "Always works from home"}
              {wfhType === "permanent_wfo" && "Always works from office"}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Fixed WFH Days <span className="text-muted-foreground text-xs">(every week, regardless of rotation)</span></Label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <Badge
                  key={day.value}
                  variant={fixedDays.includes(day.value) ? "default" : "outline"}
                  className="cursor-pointer select-none transition-all duration-200 hover:scale-105 active:scale-95"
                  onClick={() => toggleDay(day.value)}
                >
                  {day.label}
                  {fixedDays.includes(day.value) && <X className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>
            {fixedDays.length > 0 && (
              <p className="text-xs text-muted-foreground">Selected: {fixedDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
