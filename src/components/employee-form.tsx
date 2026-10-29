"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError, PreferenceFields, type Preferences } from "@/components/profile-fields";
import { Plus, Pencil, AlertTriangle, Loader2 } from "lucide-react";
import { LIMITS, validateEmployee, type FieldErrors } from "@/lib/employee-validation";
import type { WfhType, WeekDay } from "@/types";

const WFH_TYPE_WARNINGS: Record<WfhType, string> = {
  permanent_wfo: "In office except fixed WFH days. Previously picked days are cleared. Schedule re-plans from the week after next.",
  permanent_wfh: "WFH except fixed office days. Schedule re-plans from the week after next.",
  rotating: "Joins the rotation in alphabetical order. Schedule re-plans from the week after next.",
};

type InitialData = { id: string; name: string; email?: string; designation: string; wfhType: WfhType; fixedDays: WeekDay[]; color?: string };
type FormState = Preferences & { name: string; email: string; designation: string };

interface EmployeeFormProps {
  onSuccess: () => void;
  initialData?: InitialData;
  mode?: "button" | "inline";
  isSelfEdit?: boolean;
}

const toState = (d?: InitialData): FormState => ({ name: d?.name ?? "", email: d?.email ?? "", designation: d?.designation ?? "", wfhType: d?.wfhType ?? "rotating", fixedDays: d?.fixedDays ?? [], color: d?.color ?? "" });

export function EmployeeForm({ onSuccess, initialData, mode = "button", isSelfEdit = false }: EmployeeFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>(() => toState(initialData));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  const { errors, data, valid } = validateEmployee({ ...form, email: isSelfEdit ? undefined : form.email });
  const shown: FieldErrors = { ...(submitted ? errors : {}), ...serverErrors };
  const wfhTypeChanged = initialData && form.wfhType !== initialData.wfhType;
  const update = (patch: Partial<FormState>) => { setForm((f) => ({ ...f, ...patch })); setServerErrors((e) => { const next = { ...e }; (Object.keys(patch) as (keyof FieldErrors)[]).forEach((k) => delete next[k]); return next; }); };

  const handleOpenChange = (o: boolean) => {
    if (o) { setForm(toState(initialData)); setSubmitted(false); setServerErrors({}); }
    setOpen(o);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    setLoading(true);
    try {
      const res = await fetch(initialData ? `/api/employees/${initialData.id}` : "/api/employees", { method: initialData ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, color: data.color ?? undefined }) });
      const body = await res.json();
      if (!res.ok) { if (body.errors) setServerErrors(body.errors); toast.error(body.error || "Failed to save employee"); return; }
      if (body.message) toast.info(body.message, { duration: 5000 });
      onSuccess();
      setOpen(false);
      toast.success(initialData ? "Employee updated" : "Employee added");
    } catch { toast.error("Failed to save employee"); } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        className={mode === "inline"
          ? "flex items-center gap-2 px-2 py-1.5 text-sm w-full rounded-md hover:bg-accent transition-all duration-200 cursor-pointer active:scale-95"
          : "inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-all duration-200 hover:scale-105 active:scale-95"
        }
      >
        {initialData ? <><Pencil className="h-4 w-4" />{isSelfEdit ? "Edit Profile" : "Edit"}</> : <><Plus className="h-4 w-4" />Add Employee</>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialData ? (isSelfEdit ? "Edit Your Profile" : "Edit Employee") : "Add Employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="John Doe" maxLength={LIMITS.name} aria-invalid={!!shown.name} />
            <FieldError message={shown.name} />
          </div>
          {!isSelfEdit && (
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-muted-foreground text-xs">(optional, for login matching)</span></Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="john@company.com" maxLength={LIMITS.email} aria-invalid={!!shown.email} />
              <FieldError message={shown.email} />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" value={form.designation} onChange={(e) => update({ designation: e.target.value })} placeholder="Software Engineer" maxLength={LIMITS.designation} aria-invalid={!!shown.designation} />
            <FieldError message={shown.designation} />
          </div>
          <PreferenceFields value={form} onChange={update} errors={shown} typeNotice={wfhTypeChanged && (
            <Alert variant="destructive" className="mt-2 py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">{WFH_TYPE_WARNINGS[form.wfhType]}</AlertDescription>
            </Alert>
          )} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={loading} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || (submitted && !valid)}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{loading ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
