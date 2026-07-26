export type WfhType = "rotating" | "permanent_wfh" | "permanent_wfo";
export type WeekDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export type FixedDays = WeekDay[];

export interface Employee {
  id: string;
  name: string;
  designation: string;
  wfhType: WfhType;
  fixedDays: FixedDays;
  rotationOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface WeekAllocation {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  isOverride: boolean;
  createdAt: Date;
  employees: Employee[];
}

export interface Settings {
  id: number;
  availableSeats: number;
  wfhPerWeek: number;
  weekCycleLength: number;
}

export interface Admin {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export interface WeekCardData {
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  wfhEmployees: Employee[];
  wfoCount: number;
  isOverride: boolean;
}
