"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Bug, CheckCircle2, Lightbulb, Loader2, MessageSquare, MessageSquarePlus, RotateCcw } from "lucide-react";
import { useFeedback } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import type { Feedback, FeedbackType } from "@/types";

const MAX_LEN = 2000;
const TYPES: Record<FeedbackType, { label: string; icon: typeof Bug; placeholder: string; tone: string }> = {
  feedback: { label: "Feedback", icon: MessageSquare, placeholder: "What's working, what's not?", tone: "text-sky-400" },
  feature: { label: "Feature request", icon: Lightbulb, placeholder: "Describe the feature and the problem it solves...", tone: "text-yellow-400" },
  bug: { label: "Report a bug", icon: Bug, placeholder: "What happened, what you expected, and steps to reproduce...", tone: "text-red-400" },
};

export function FeedbackDialog({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feedback"), [message, setMessage] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const { feedback, isLoading, mutate } = useFeedback(open);
  const openCount = feedback.filter((f) => f.status === "open").length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending("submit");
    try {
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, message }) });
      if (!res.ok) { toast.error((await res.json()).error ?? "Failed to submit"); return; }
      const row: Feedback = await res.json();
      mutate((list = []) => [row, ...list], { revalidate: false });
      setMessage("");
      toast.success(`${TYPES[type].label} sent. Thanks!`);
    } catch { toast.error("Failed to submit"); } finally { setPending(null); }
  };

  const toggleStatus = async (f: Feedback) => {
    const status = f.status === "open" ? "resolved" : "open";
    setPending(f.id);
    try {
      const res = await fetch(`/api/feedback/${f.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) { toast.error((await res.json()).error ?? "Failed to update"); return; }
      mutate((list = []) => list.map((x) => (x.id === f.id ? { ...x, status } : x)), { revalidate: false });
    } catch { toast.error("Failed to update"); } finally { setPending(null); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger data-tour="feedback" aria-label="Feedback" className="p-2 rounded-full hover:bg-muted transition-colors cursor-pointer">
        <MessageSquarePlus className="h-5 w-5 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share feedback</DialogTitle>
          <DialogDescription>Send feedback, ask for a feature or report a bug. Admins review every submission.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type">
            {(Object.keys(TYPES) as FeedbackType[]).map((key) => {
              const { label, icon: Icon, tone } = TYPES[key];
              return (
                <button key={key} type="button" role="radio" aria-checked={type === key} onClick={() => setType(key)} className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-all active:scale-95", type === key ? "border-primary bg-primary/10" : "hover:bg-muted")}>
                  <Icon className={cn("h-4 w-4", tone)} />{label}
                </button>
              );
            })}
          </div>
          <Textarea required rows={4} maxLength={MAX_LEN} className="max-h-48" placeholder={TYPES[type].placeholder} value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{message.length}/{MAX_LEN}</span>
            <Button type="submit" disabled={pending === "submit" || !message.trim()}>{pending === "submit" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{pending === "submit" ? "Sending..." : "Send"}</Button>
          </div>
        </form>
        <div className="space-y-2 border-t pt-3">
          <h4 className="text-sm font-semibold">{isAdmin ? "All submissions" : "Your submissions"}{openCount > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{openCount} open</span>}</h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
              : feedback.length === 0 ? <p className="py-3 text-center text-sm text-muted-foreground">Nothing submitted yet</p>
              : feedback.map((f) => {
                const { label, icon: Icon, tone } = TYPES[f.type], resolved = f.status === "resolved";
                return (
                  <div key={f.id} className={cn("rounded-md border px-3 py-2 text-sm", resolved && "opacity-60")}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} />
                      <span className="text-xs font-medium">{label}</span>
                      <Badge variant={resolved ? "secondary" : "outline"} className="h-4 px-1.5 text-[10px]">{resolved ? "Resolved" : "Open"}</Badge>
                      <span className="ml-auto text-[10px] text-muted-foreground">{isAdmin && f.authorName && `${f.authorName} · `}{formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}</span>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" title={resolved ? "Reopen" : "Mark resolved"} disabled={pending === f.id} onClick={() => toggleStatus(f)}>
                          {pending === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        </Button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{f.message}</p>
                  </div>
                );
              })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
