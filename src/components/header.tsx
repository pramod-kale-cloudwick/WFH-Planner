"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { format, formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users, Settings, LogOut, Home, Bell, MessageCircle } from "lucide-react";
import type { DateAnnotation } from "@/types";

export function Header() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<DateAnnotation[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const initials = session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U";

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/annotations/recent");
      const data = await res.json();
      setNotifications(data);
      const lastSeen = localStorage.getItem("lastSeenNotification");
      if (lastSeen) {
        const count = data.filter((n: DateAnnotation) => new Date(n.createdAt) > new Date(lastSeen)).length;
        setUnreadCount(count);
      } else {
        setUnreadCount(data.length);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchNotifications(); const interval = setInterval(fetchNotifications, 30000); return () => clearInterval(interval); }, [fetchNotifications]);

  const markAsRead = () => { localStorage.setItem("lastSeenNotification", new Date().toISOString()); setUnreadCount(0); };

  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg transition-opacity duration-200 hover:opacity-80">
            <img src="/favicon.png" alt="WFH Planner" width={28} height={28} className="rounded transition-transform duration-200 hover:scale-110" />
            WFH Planner
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-muted transition-all duration-200 active:scale-95">
              <Home className="h-4 w-4" />Dashboard
            </Link>
            <Link href="/employees" className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-muted transition-all duration-200 active:scale-95">
              <Users className="h-4 w-4" />Employees
            </Link>
            <Link href="/settings" className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg hover:bg-muted transition-all duration-200 active:scale-95">
              <Settings className="h-4 w-4" />Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Popover onOpenChange={(open) => open && markAsRead()}>
            <PopoverTrigger className="relative p-2 rounded-full hover:bg-muted transition-colors">
              <Bell className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-3 border-b">
                <h4 className="text-sm font-semibold">Recent Notes</h4>
                <p className="text-xs text-muted-foreground">Latest comments on calendar dates</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No notes yet</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 border-b last:border-0 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start gap-2">
                        <MessageCircle className="h-4 w-4 mt-0.5 text-yellow-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{n.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{n.authorName}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-primary">{format(new Date(n.date), "MMM d")}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <DropdownMenu>
            <DropdownMenuTrigger className="relative h-8 w-8 rounded-full focus:outline-none focus:ring-2 focus:ring-ring">
              <Avatar className="h-8 w-8">
                <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <div className="flex items-center gap-2 p-2">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{session?.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="mr-2 h-4 w-4" />Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
