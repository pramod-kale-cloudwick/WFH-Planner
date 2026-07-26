"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Settings, LogOut, Home } from "lucide-react";

export function Header() {
  const { data: session } = useSession();
  const initials = session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U";

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
    </header>
  );
}
