import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// NextAuth required tables
export const users = sqliteTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable("account", {
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })]);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
}, (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]);

// App tables
export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  designation: text("designation").notNull(),
  wfhType: text("wfh_type", { enum: ["rotating", "permanent_wfh", "permanent_wfo"] }).notNull().default("rotating"),
  fixedDays: text("fixed_days").default("[]"),
  rotationOrder: integer("rotation_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const weekAllocations = sqliteTable("week_allocations", {
  id: text("id").primaryKey(),
  weekStart: text("week_start").notNull(),
  weekEnd: text("week_end").notNull(),
  weekNumber: integer("week_number").notNull(),
  isOverride: integer("is_override", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const allocationEmployees = sqliteTable("allocation_employees", {
  id: text("id").primaryKey(),
  allocationId: text("allocation_id").notNull().references(() => weekAllocations.id, { onDelete: "cascade" }),
  employeeId: text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  availableSeats: integer("available_seats").notNull().default(8),
  wfhPerWeek: integer("wfh_per_week").notNull().default(2),
  weekCycleLength: integer("week_cycle_length").notNull().default(5),
});

export const swapHistory = sqliteTable("swap_history", {
  id: text("id").primaryKey(),
  allocationId: text("allocation_id").notNull().references(() => weekAllocations.id, { onDelete: "cascade" }),
  fromEmployeeId: text("from_employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  toEmployeeId: text("to_employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  swappedAt: integer("swapped_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const dateAnnotations = sqliteTable("date_annotations", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  message: text("message").notNull(),
  authorId: text("author_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

// Relations
export const employeesRelations = relations(employees, ({ many }) => ({
  allocations: many(allocationEmployees),
}));

export const weekAllocationsRelations = relations(weekAllocations, ({ many }) => ({
  employees: many(allocationEmployees),
}));

export const allocationEmployeesRelations = relations(allocationEmployees, ({ one }) => ({
  allocation: one(weekAllocations, { fields: [allocationEmployees.allocationId], references: [weekAllocations.id] }),
  employee: one(employees, { fields: [allocationEmployees.employeeId], references: [employees.id] }),
}));
