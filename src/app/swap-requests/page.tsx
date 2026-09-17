"use client";

import { useCallback } from "react";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowRightLeft, Check, X, Clock, Trash2 } from "lucide-react";
import { useSwapRequests, useEmployees } from "@/lib/hooks";
import type { SwapRequest } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending_target: { label: "Awaiting Target", color: "bg-yellow-500/20 text-yellow-400", icon: Clock },
  pending_admin: { label: "Awaiting Admin", color: "bg-blue-500/20 text-blue-400", icon: Clock },
  approved: { label: "Approved", color: "bg-green-500/20 text-green-400", icon: Check },
  rejected: { label: "Rejected", color: "bg-red-500/20 text-red-400", icon: X },
};

export default function SwapRequestsPage() {
  const { data: session } = useSession();
  const { requests, isLoading, mutate } = useSwapRequests();
  const { employees } = useEmployees();
  const isAdmin = session?.user?.isAdmin ?? false;
  const userEmail = session?.user?.email;
  const currentUser = employees.find((e) => e.email === userEmail);

  const handleAction = useCallback(async (id: string, action: "approve" | "reject") => {
    try {
      const res = await fetch(`/api/swap-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Action failed"); return; }
      toast.success(data.message);
      mutate();
    } catch { toast.error("Action failed"); }
  }, [mutate]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/swap-requests/${id}`, { method: "DELETE" });
      if (!res.ok) { const data = await res.json(); toast.error(data.error || "Failed to cancel"); return; }
      toast.success("Request cancelled");
      mutate();
    } catch { toast.error("Failed to cancel"); }
  }, [mutate]);

  const pendingForMe = requests.filter((r: SwapRequest) => (r.status === "pending_target" && r.targetId === currentUser?.id) || (r.status === "pending_admin" && isAdmin));
  const myRequests = requests.filter((r: SwapRequest) => r.initiatorId === currentUser?.id);
  const otherRequests = requests.filter((r: SwapRequest) => r.initiatorId !== currentUser?.id && !pendingForMe.includes(r));

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold">Swap Requests</h1>
              <p className="text-muted-foreground">Manage WFH week swap requests</p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-8">
            {/* Pending for me */}
            {pendingForMe.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-400" />
                  Requires Your Action ({pendingForMe.length})
                </h2>
                <div className="grid gap-4">
                  {pendingForMe.map((req: SwapRequest) => (
                    <RequestCard key={req.id} request={req} currentUserId={currentUser?.id} isAdmin={isAdmin} onAction={handleAction} onDelete={handleDelete} showActions />
                  ))}
                </div>
              </section>
            )}

            {/* My requests */}
            <section>
              <h2 className="text-lg font-semibold mb-4">My Requests</h2>
              {myRequests.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">No swap requests initiated by you</CardContent></Card>
              ) : (
                <div className="grid gap-4">
                  {myRequests.map((req: SwapRequest) => (
                    <RequestCard key={req.id} request={req} currentUserId={currentUser?.id} isAdmin={isAdmin} onAction={handleAction} onDelete={handleDelete} canCancel />
                  ))}
                </div>
              )}
            </section>

            {/* Other requests (for admin view) */}
            {isAdmin && otherRequests.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">All Other Requests</h2>
                <div className="grid gap-4">
                  {otherRequests.map((req: SwapRequest) => (
                    <RequestCard key={req.id} request={req} currentUserId={currentUser?.id} isAdmin={isAdmin} onAction={handleAction} onDelete={handleDelete} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

interface RequestCardProps {
  request: SwapRequest;
  currentUserId?: string;
  isAdmin: boolean;
  onAction: (id: string, action: "approve" | "reject") => void;
  onDelete: (id: string) => void;
  showActions?: boolean;
  canCancel?: boolean;
}

function RequestCard({ request, currentUserId, isAdmin, onAction, onDelete, showActions, canCancel }: RequestCardProps) {
  const config = STATUS_CONFIG[request.status];
  const StatusIcon = config.icon;
  const canAct = showActions && ((request.status === "pending_target" && request.targetId === currentUserId) || (request.status === "pending_admin" && isAdmin));
  const canDelete = canCancel && ["pending_target", "pending_admin"].includes(request.status);

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="font-medium">{request.initiatorName}</span>
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{request.targetName}</span>
          </CardTitle>
          <Badge className={config.color}><StatusIcon className="h-3 w-3 mr-1" />{config.label}</Badge>
        </div>
        <CardDescription className="text-xs">
          Week {request.initiatorWeek?.weekNumber} ({request.initiatorWeek && format(new Date(request.initiatorWeek.weekStart), "MMM d")})
          {" ↔ "}
          Week {request.targetWeek?.weekNumber} ({request.targetWeek && format(new Date(request.targetWeek.weekStart), "MMM d")})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Requested {format(new Date(request.createdAt), "MMM d, h:mm a")}</span>
          <div className="flex gap-2">
            {canAct && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium h-8 px-3 border border-input bg-background shadow-xs hover:bg-accent text-red-400 hover:text-red-300 hover:bg-red-500/10">
                    <X className="h-4 w-4" />Reject
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reject swap request?</AlertDialogTitle>
                      <AlertDialogDescription>The initiator will be notified that you rejected their swap request.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onAction(request.id, "reject")}>Reject</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" onClick={() => onAction(request.id, "approve")} className="bg-green-600 hover:bg-green-500">
                  <Check className="h-4 w-4 mr-1" />Approve
                </Button>
              </>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-sm font-medium h-8 px-2 hover:bg-accent text-muted-foreground hover:text-red-400">
                  <Trash2 className="h-4 w-4" />
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel swap request?</AlertDialogTitle>
                    <AlertDialogDescription>This will cancel your pending swap request.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Request</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(request.id)}>Cancel Request</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
