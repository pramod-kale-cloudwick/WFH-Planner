import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const pathname = req.nextUrl.pathname;
  const isLoginPage = pathname === "/login";
  const isOnboardingPage = pathname === "/onboarding";
  const isApiRoute = pathname.startsWith("/api");
  const isOnboarded = req.auth?.user?.isOnboarded ?? false;

  if (isApiRoute) return NextResponse.next();

  if (!isLoggedIn && !isLoginPage) return NextResponse.redirect(new URL("/login", req.url));
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL(isOnboarded ? "/" : "/onboarding", req.url));
  }
  if (isLoggedIn && !isOnboarded && !isOnboardingPage) return NextResponse.redirect(new URL("/onboarding", req.url));
  if (isLoggedIn && isOnboarded && isOnboardingPage) return NextResponse.redirect(new URL("/", req.url));

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.png$).*)"],
};
