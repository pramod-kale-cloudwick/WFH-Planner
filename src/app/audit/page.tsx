"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Undo2, ArrowLeftRight, History } from "lucide-react";

interface SwapRecord {
  id: string;
  allocationId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  fromEmployeeName: string;
  toEmployeeName: string;
  swappedAt: string;
  weekStart: string;
  weekEnd: string;
  weekNumber: number;
}

export default function AuditPage() {
  const { data: session } = useSession();
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [undoing, setUndoing] = useState<string | null>(null);
  const isAdmin = session?.user?.isAdmin ?? false;

  const fetchSwaps = useCallback(async () => {
    try {
      const res = await fetch("/api/swaps");
      const data = await res.json();
      setSwaps(data);
    } catch { toast.error("Failed to load swap history"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSwaps(); }, [fetchSwaps]);

  const handleUndo = async (swapId: string) => {
    setUndoing(swapId);
    try {
      const res = await fetch("/api/swaps/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ swapId }) });
      if (!res.ok) { const data = await res.json(); toast.error(data.error || "Failed to undo"); return; }
      toast.success("Swap undone successfully");
      fetchSwaps();
    } catch { toast.error("Failed to undo swap"); }
    finally { setUndoing(null); }
  };

  const groupedSwaps = swaps.reduce((acc, swap) => {
    const date = format(new Date(swap.swappedAt), "yyyy-MM-dd");
    if (!acc[date]) acc[date] = [];
    acc[date].push(swap);
    return acc;
  }, {} as Record<string, SwapRecord[]>);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <History className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-2xl font-bold">Swap Audit Log</h1>
              <p className="text-muted-foreground">{isAdmin ? "View and manage all swap history" : "View swap history (admin can undo)"}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : swaps.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No swaps recorded yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSwaps).sort((a, b) => b[0].localeCompare(a[0])).map(([date, daySwaps]) => (
              <Card key={date}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{format(new Date(date), "EEEE, MMMM d, yyyy")}</CardTitle>
                  <CardDescription>{daySwaps.length} swap{daySwaps.length !== 1 ? "s" : ""}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Swap</TableHead>
                        <TableHead>Week</TableHead>
                        <TableHead>Time</TableHead>
                        {isAdmin && <TableHead className="w-24">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daySwaps.map((swap) => (
                        <TableRow key={swap.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-red-500/10 text-red-400">{swap.fromEmployeeName}</Badge>
                              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                              <Badge variant="outline" className="bg-green-500/10 text-green-400">{swap.toEmployeeName}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">Week {swap.weekNumber}</span>
                            <span className="text-xs text-muted-foreground ml-2">({format(new Date(swap.weekStart), "MMM d")} - {format(new Date(swap.weekEnd), "MMM d")})</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(swap.swappedAt), { addSuffix: true })}</span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <AlertDialog>
                                <AlertDialogTrigger disabled={undoing === swap.id} className="inline-flex items-center justify-center gap-1 text-sm text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 px-2 py-1 rounded-md transition-colors disabled:opacity-50">
                                  <Undo2 className="h-4 w-4" />Undo
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Undo this swap?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will revert {swap.fromEmployeeName} and {swap.toEmployeeName} back to their original weeks.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleUndo(swap.id)}>Undo Swap</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
