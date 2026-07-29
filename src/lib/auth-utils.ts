import { auth } from "./auth";

export async function isAdmin(): Promise<boolean> {
  const session = await auth();
  return session?.user?.isAdmin ?? false;
}

export async function requireAdmin() {
  const admin = await isAdmin();
  if (!admin) throw new Error("Unauthorized: Admin access required");
  return true;
}
