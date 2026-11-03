import { useSyncExternalStore } from "react";
import useSWR from "swr";
import type { Employee, WeekAllocation, DateAnnotation, SwapRequest, AwayPeriod } from "@/types";

// Throwing on non-2xx keeps error payloads out of `data`, so list hooks fall back to []
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`Request failed: ${url}`), { status: res.status });
  return res.json();
};

export type CalendarMode = "wfh" | "office";
const MODE_KEY = "calendar-mode", MODE_EVENT = "calendar-mode-change";
const subscribeMode = (cb: () => void) => {
  window.addEventListener(MODE_EVENT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(MODE_EVENT, cb); window.removeEventListener("storage", cb); };
};
const readMode = (): CalendarMode => (localStorage.getItem(MODE_KEY) === "office" ? "office" : "wfh");

/** Calendar shows who's WFH (default) or who's in office; persisted per browser and shared across components. */
export function useCalendarMode() {
  const mode = useSyncExternalStore(subscribeMode, readMode, (): CalendarMode => "wfh");
  const setMode = (next: CalendarMode) => { localStorage.setItem(MODE_KEY, next); window.dispatchEvent(new Event(MODE_EVENT)); };
  return [mode, setMode] as const;
}

export function useEmployees() {
  const { data, error, isLoading, mutate } = useSWR<Employee[]>("/api/employees", fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  return { employees: data || [], error, isLoading, mutate };
}

export function useAllocations(year: number, month: number) {
  const { data, error, isLoading, mutate } = useSWR<WeekAllocation[]>(`/api/allocations?year=${year}&month=${month}`, fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  return { allocations: (Array.isArray(data) ? data : []).map((a) => ({ ...a, weekStart: new Date(a.weekStart), weekEnd: new Date(a.weekEnd) })) || [], error, isLoading, mutate };
}

export function useAnnotations(startDate: string, endDate: string) {
  const { data, error, isLoading, mutate } = useSWR<DateAnnotation[]>(`/api/annotations?startDate=${startDate}&endDate=${endDate}`, fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  return { annotations: data || [], error, isLoading, mutate };
}

export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<{ availableSeats: number; weekCycleLength: number }>("/api/settings", fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 });
  return { settings: data, error, isLoading, mutate };
}

export function useAway() {
  const { data, error, isLoading, mutate } = useSWR<AwayPeriod[]>("/api/away", fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  return { away: Array.isArray(data) ? data : [], error, isLoading, mutate };
}

export function useSwapRequests() {
  const { data, error, isLoading, mutate } = useSWR<SwapRequest[]>("/api/swap-requests", fetcher, { revalidateOnFocus: true, refreshInterval: 30000 });
  return { requests: data || [], error, isLoading, mutate };
}
