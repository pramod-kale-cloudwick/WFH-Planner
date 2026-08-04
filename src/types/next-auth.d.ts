import "next-auth";

declare module "next-auth" {
  interface User {
    isAdmin?: boolean;
    isOnboarded?: boolean;
  }
  interface Session {
    user: User & { id: string; isAdmin: boolean; isOnboarded: boolean };
  }
}
