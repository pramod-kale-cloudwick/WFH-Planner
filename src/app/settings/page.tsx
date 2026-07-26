"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Save } from "lucide-react";
import type { Settings, Employee } from "@/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchData = useCallback(async () => {
    const [settingsRes, empRes] = await Promise.all([fetch("/api/settings"), fetch("/api/employees")]);
    const [settingsData, empData] = await Promise.all([settingsRes.json(), empRes.json()]);
    setSettings(settingsData);
    setEmployees(empData);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaving(false);
    toast.success("Settings saved");
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    await fetch("/api/allocations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weeksCount: 20 }) });
    setRegenerating(false);
    toast.success("Schedule regenerated");
  };

  const rotatingCount = employees.filter((e) => e.wfhType === "rotating" && e.isActive).length;
  const calculatedWfh = settings ? Math.max(0, rotatingCount - settings.availableSeats) : 0;

  if (loading || !settings) return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure WFH allocation parameters</p>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Capacity Settings</CardTitle>
              <CardDescription>Configure office capacity and rotation cycle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seats">Available Office Seats</Label>
                  <Input id="seats" type="number" min={1} value={settings.availableSeats} onChange={(e) => setSettings({ ...settings, availableSeats: parseInt(e.target.value) || 1 })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cycle">Week Cycle Length</Label>
                  <Input id="cycle" type="number" min={1} max={10} value={settings.weekCycleLength} onChange={(e) => setSettings({ ...settings, weekCycleLength: parseInt(e.target.value) || 1 })} />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{rotatingCount}</p>
                  <p className="text-xs text-muted-foreground">Rotating Employees</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{settings.availableSeats}</p>
                  <p className="text-xs text-muted-foreground">Office Seats</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-2xl font-bold text-primary">{calculatedWfh}</p>
                  <p className="text-xs text-muted-foreground">WFH Per Week</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">WFH slots auto-calculated: Rotating Employees ({rotatingCount}) - Seats ({settings.availableSeats}) = {calculatedWfh}</p>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Settings"}</Button>
            <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}><RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />{regenerating ? "Regenerating..." : "Regenerate Schedule"}</Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>WFH slots</strong> are auto-calculated based on seats vs rotating employees.</p>
              <p><strong>Rotating employees</strong> cycle through WFH weeks based on their order.</p>
              <p><strong>Permanent WFH/WFO</strong> employees are excluded from rotation.</p>
              <p><strong>Day-fixed</strong> employees have WFH on a specific day each week.</p>
              <p><strong>Swapping</strong> creates a one-time override without affecting future weeks.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
