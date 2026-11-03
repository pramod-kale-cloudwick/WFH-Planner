"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plane, X } from "lucide-react";
import { workWeek } from "@/lib/utils";
import type { AwayPeriod, Employee } from "@/types";

interface AwayDialogProps {
  employee: Employee;
  periods: AwayPeriod[];
  onChange: () => void;
}

export const awaySpan = (p: AwayPeriod) => `${format(workWeek(p.fromWeek).monday, "MMM d")} – ${format(workWeek(p.toWeek).friday, "MMM d")}`;

export function AwayDialog({ employee, periods, onChange }: AwayDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ from: "", to: "", reason: "" });
  const [pending, setPending] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending("save");
    try {
      const res = await fetch("/api/away", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: employee.id, ...form }) });
      if (!res.ok) { toast.error((await res.json()).error ?? "Failed to save away period"); return; }
      setForm({ from: "", to: "", reason: "" });
      onChange();
      toast.success(`${employee.name} marked away. Schedule re-planned.`);
    } catch { toast.error("Failed to save away period"); } finally { setPending(null); }
  };

  const handleCancel = async (id: string) => {
    setPending(id);
    try {
      const res = await fetch(`/api/away/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error((await res.json()).error ?? "Failed to cancel away period"); return; }
      onChange();
      toast.success("Away period cancelled");
    } catch { toast.error("Failed to cancel away period"); } finally { setPending(null); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-all duration-200 cursor-pointer active:scale-95">
        <Plane className="h-4 w-4" />Away
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{employee.name} · Away periods</DialogTitle>
          <DialogDescription>Whole weeks (Mon – Fri). Rotation stays as is; WFH turns inside lapse and the freed seat brings one WFH person back to office. Current and next week only refresh seat bumps.</DialogDescription>
        </DialogHeader>
        {periods.length > 0 && (
          <div className="space-y-2">
            {periods.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{awaySpan(p)}{p.reason && <span className="text-muted-foreground"> · {p.reason}</span>}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={pending === p.id} onClick={() => handleCancel(p.id)}>
                  {pending === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="away-from">From</Label><Input id="away-from" type="date" required value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="away-to">To</Label><Input id="away-to" type="date" required min={form.from} value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="away-reason">Reason <span className="text-muted-foreground text-xs">(optional)</span></Label><Input id="away-reason" maxLength={120} placeholder="Vacation, offsite..." value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={pending === "save"} onClick={() => setOpen(false)}>Close</Button>
            <Button type="submit" disabled={pending === "save" || !form.from || !form.to}>{pending === "save" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{pending === "save" ? "Saving..." : "Mark away"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
