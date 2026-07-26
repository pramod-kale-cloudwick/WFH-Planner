"use client";

import { Header } from "@/components/header";
import { MonthView } from "@/components/month-view";

export default function DashboardPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">View and manage weekly WFH schedules</p>
        </div>
        <MonthView />
      </main>
    </div>
  );
}
