"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { WfhType, WeekDay } from "@/types";

const WEEKDAYS: { value: WeekDay; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
];

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [wfhType, setWfhType] = useState<WfhType>("rotating");
  const [fixedDays, setFixedDays] = useState<WeekDay[]>([]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.isOnboarded) router.replace("/");
    if (status === "authenticated" && session?.user?.name && !name) setName(session.user.name);
  }, [status, session, router, name]);

  const toggleDay = (day: WeekDay) => {
    setFixedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/employees/onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, designation, wfhType, fixedDays }) });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Onboarding failed");
        return;
      }
      const data = await res.json();
      await update();
      toast.success(data.isFirstUser ? "Welcome, admin! Profile set up." : "Profile set up. You're in.");
      router.replace("/");
    } catch {
      toast.error("Onboarding failed");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg animate-in fade-in duration-300">
        <CardHeader>
          <CardTitle className="text-2xl">Complete your profile</CardTitle>
          <CardDescription>
            First time here. Drop your details so we can slot you into the roster.
            {session?.user?.email && <span className="block mt-1 text-xs">Signed in as {session.user.email}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
            </div>
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
                <SelectContent className="min-w-70">
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
              <Label>Fixed WFH Days <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <Badge key={day.value} variant={fixedDays.includes(day.value) ? "default" : "outline"} className="cursor-pointer select-none transition-all duration-200 hover:scale-105 active:scale-95" onClick={() => toggleDay(day.value)}>
                    {day.label}
                    {fixedDays.includes(day.value) && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                ))}
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving..." : "Continue"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
