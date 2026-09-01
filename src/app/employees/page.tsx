"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Header } from "@/components/header";
import { EmployeeForm } from "@/components/employee-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { Employee, WfhType } from "@/types";

const wfhTypeLabels: Record<WfhType, string> = { rotating: "Rotating", permanent_wfh: "Permanent WFH", permanent_wfo: "Permanent WFO" };
const wfhTypeColors: Record<WfhType, string> = { rotating: "bg-blue-500/20 text-blue-400", permanent_wfh: "bg-green-500/20 text-green-400", permanent_wfo: "bg-orange-500/20 text-orange-400" };

export default function EmployeesPage() {
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const isAdmin = session?.user?.isAdmin ?? false;
  const userEmail = session?.user?.email;

  const fetchEmployees = useCallback(async () => {
    const res = await fetch("/api/employees");
    const data = await res.json();
    setEmployees(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const canEdit = (emp: Employee) => isAdmin || emp.email === userEmail;

  const handleDelete = async (id: string, name: string) => {
    toast.warning(`Delete ${name}?`, {
      action: { label: "Delete", onClick: async () => {
        await fetch(`/api/employees/${id}`, { method: "DELETE" });
        fetchEmployees();
        toast.success("Employee deleted");
      }},
    });
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    const index = employees.findIndex((e) => e.id === id);
    if ((direction === "up" && index === 0) || (direction === "down" && index === employees.length - 1)) return;
    const newEmployees = [...employees];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    [newEmployees[index], newEmployees[swapIndex]] = [newEmployees[swapIndex], newEmployees[index]];
    setEmployees(newEmployees);
    await fetch("/api/employees/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderedIds: newEmployees.map((e) => e.id) }) });
  };

  const formatFixedDays = (days: string[]) => {
    if (!days || days.length === 0) return null;
    return days.map((d) => d.slice(0, 3).toUpperCase()).join(", ");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Employees</h1>
            <p className="text-muted-foreground">{isAdmin ? "Manage team members and their WFH preferences" : "View team members and edit your profile"}</p>
          </div>
          {isAdmin && <EmployeeForm onSuccess={fetchEmployees} />}
        </div>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">No employees yet. Add your first team member.</div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && <TableHead className="w-12"></TableHead>}
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>WFH Type</TableHead>
                  <TableHead>Fixed Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp, idx) => (
                  <TableRow key={emp.id} className={`transition-colors duration-200 ${emp.email === userEmail ? "bg-primary/5" : ""}`}>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMove(emp.id, "up")} disabled={idx === 0}><ArrowUp className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMove(emp.id, "down")} disabled={idx === employees.length - 1}><ArrowDown className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{emp.name} {emp.email === userEmail && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}</TableCell>
                    <TableCell>{emp.designation}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={wfhTypeColors[emp.wfhType]}>{wfhTypeLabels[emp.wfhType]}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatFixedDays(emp.fixedDays) ? (
                        <Badge variant="outline" className="bg-purple-500/20 text-purple-400">{formatFixedDays(emp.fixedDays)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.isActive ? "default" : "secondary"}>{emp.isActive ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canEdit(emp) && <EmployeeForm onSuccess={fetchEmployees} initialData={emp} mode="inline" isSelfEdit={emp.email === userEmail && !isAdmin} />}
                        {isAdmin && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id, emp.name)} className="h-8 w-8 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
