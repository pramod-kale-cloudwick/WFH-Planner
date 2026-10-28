"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, PreferenceFields, type Preferences } from "@/components/profile-fields";
import { Loader2 } from "lucide-react";
import { LIMITS, validateEmployee } from "@/lib/employee-validation";

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [typedName, setName] = useState<string | null>(null);
  const [designation, setDesignation] = useState("");
  const [prefs, setPrefs] = useState<Preferences>({ wfhType: "rotating", fixedDays: [], color: "" });
  const [submitted, setSubmitted] = useState(false);
  // GitHub name is only a default until the user edits the field
  const name = typedName ?? session?.user?.name ?? "";
  const { errors, data, valid } = validateEmployee({ name, designation, ...prefs });
  const shown = submitted ? errors : {};

  useEffect(() => {
    if (status === "authenticated" && session?.user?.isOnboarded) router.replace("/");
  }, [status, session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    setLoading(true);
    try {
      const res = await fetch("/api/employees/onboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, color: data.color ?? undefined }) });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || "Onboarding failed"); return; }
      await update();
      toast.success(body.isFirstUser ? "Welcome, admin! Profile set up." : "Profile set up. You're in.");
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
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" maxLength={LIMITS.name} aria-invalid={!!shown.name} />
              <FieldError message={shown.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" value={designation} onChange={(e) => setDesignation(e.target.value)} placeholder="Software Engineer" maxLength={LIMITS.designation} aria-invalid={!!shown.designation} />
              <FieldError message={shown.designation} />
            </div>
            <PreferenceFields value={prefs} onChange={(p) => setPrefs((prev) => ({ ...prev, ...p }))} errors={shown} />
            <Button type="submit" className="w-full" disabled={loading || (submitted && !valid)}>{loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{loading ? "Saving..." : "Continue"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
