import useSWR from "swr";
import type { Employee, WeekAllocation, DateAnnotation, SwapRequest } from "@/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useEmployees() {
  const { data, error, isLoading, mutate } = useSWR<Employee[]>("/api/employees", fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  return { employees: data || [], error, isLoading, mutate };
}

export function useAllocations(year: number, month: number) {
  const { data, error, isLoading, mutate } = useSWR<WeekAllocation[]>(`/api/allocations?year=${year}&month=${month}`, fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  return { allocations: data?.map((a) => ({ ...a, weekStart: new Date(a.weekStart), weekEnd: new Date(a.weekEnd) })) || [], error, isLoading, mutate };
}

export function useAnnotations(startDate: string, endDate: string) {
  const { data, error, isLoading, mutate } = useSWR<DateAnnotation[]>(`/api/annotations?startDate=${startDate}&endDate=${endDate}`, fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  return { annotations: data || [], error, isLoading, mutate };
}

export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<{ availableSeats: number; cycleLength: number }>("/api/settings", fetcher, { revalidateOnFocus: false, dedupingInterval: 60000 });
  return { settings: data, error, isLoading, mutate };
}

export function useSwapRequests() {
  const { data, error, isLoading, mutate } = useSWR<SwapRequest[]>("/api/swap-requests", fetcher, { revalidateOnFocus: true, refreshInterval: 30000 });
  return { requests: data || [], error, isLoading, mutate };
}
