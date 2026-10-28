"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, X } from "lucide-react";
import { allowsFixedDays, WEEKDAY_LIST, type FieldErrors } from "@/lib/employee-validation";
import type { WfhType, WeekDay } from "@/types";

const PRESET_COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F97316", "#EC4899", "#06B6D4", "#EAB308", "#EF4444", "#6366F1", "#14B8A6", "#F59E0B", "#84CC16"];
const TYPE_LABELS: Record<WfhType, { label: string; hint: string }> = {
  rotating: { label: "Rotating", hint: "Full week WFH on your rotation turn" },
  permanent_wfh: { label: "Permanent WFH", hint: "Always works from home" },
  permanent_wfo: { label: "Permanent WFO", hint: "Always works from office" },
};

export type Preferences = { wfhType: WfhType; fixedDays: WeekDay[]; color: string };

export function FieldError({ id, message }: { id?: string; message?: string }) {
  return message ? <p id={id} role="alert" className="text-xs text-destructive">{message}</p> : null;
}

/** WFH type, badge colour and fixed office days, with type-aware rules shared by onboarding and the employee form. */
export function PreferenceFields({ value, onChange, errors, typeNotice }: { value: Preferences; onChange: (patch: Partial<Preferences>) => void; errors: FieldErrors; typeNotice?: ReactNode }) {
  const { wfhType, fixedDays, color } = value, canPickDays = allowsFixedDays(wfhType), atLimit = fixedDays.length >= WEEKDAY_LIST.length - 1;
  const setType = (type: WfhType) => onChange({ wfhType: type, ...(!allowsFixedDays(type) && { fixedDays: [] }) });
  const toggleDay = (day: WeekDay) => onChange({ fixedDays: fixedDays.includes(day) ? fixedDays.filter((d) => d !== day) : WEEKDAY_LIST.filter((d) => d === day || fixedDays.includes(d)) });

  return (
    <>
      <div className="space-y-2">
        <Label>WFH Type</Label>
        <Select value={wfhType} onValueChange={(v) => v && setType(v as WfhType)}>
          <SelectTrigger aria-invalid={!!errors.wfhType}><SelectValue>{TYPE_LABELS[wfhType].label}</SelectValue></SelectTrigger>
          <SelectContent className="min-w-70">
            {(Object.keys(TYPE_LABELS) as WfhType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABELS[t].label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{TYPE_LABELS[wfhType].hint}</p>
        <FieldError message={errors.wfhType} />
        {typeNotice}
      </div>
      <div className="space-y-2">
        <Label>Badge Color <span className="text-muted-foreground text-xs">(optional, shown on calendar)</span></Label>
        <div className="flex flex-wrap items-center gap-2">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => onChange({ color: c })} style={{ backgroundColor: c }} aria-label={`Colour ${c}`} className={`w-6 h-6 rounded-full transition-all duration-200 hover:scale-110 ${color.toLowerCase() === c.toLowerCase() ? "ring-2 ring-offset-2 ring-offset-background ring-white" : "opacity-70 hover:opacity-100"}`} />
          ))}
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">or</span>
            <Input type="text" placeholder="#hex" value={color} aria-invalid={!!errors.color} onChange={(e) => { const v = e.target.value.trim().replace(/[^#0-9a-f]/gi, ""); onChange({ color: v && !v.startsWith("#") ? `#${v}` : v }); }} className="w-20 h-7 text-xs px-2" maxLength={7} />
          </div>
          {color && <button type="button" onClick={() => onChange({ color: "" })} className="text-xs text-muted-foreground hover:text-foreground">Clear</button>}
        </div>
        <FieldError message={errors.color} />
      </div>
      <div className="space-y-2">
        <Label>Fixed Office Days <span className="text-muted-foreground text-xs">(optional, in office every week, even on WFH weeks)</span></Label>
        {canPickDays ? (
          <>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LIST.map((day) => {
                const selected = fixedDays.includes(day), locked = !selected && atLimit;
                return (
                  <Badge key={day} variant={selected ? "default" : "outline"} aria-disabled={locked} title={locked ? "In office all 5 days? Choose Permanent WFO instead" : undefined} className={`select-none capitalize transition-all duration-200 ${locked ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-95"}`} onClick={() => !locked && toggleDay(day)}>
                    {day}{selected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{atLimit ? "Max 4 days. Every day in office means Permanent WFO." : "Pick up to 4 days."}</p>
          </>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"><Building2 className="h-4 w-4 shrink-0" />Not needed. Permanent WFO is in office every day.</div>
        )}
        <FieldError message={errors.fixedDays} />
      </div>
    </>
  );
}
