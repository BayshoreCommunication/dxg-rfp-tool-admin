import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "./auth";

export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const callbackUrlParam = request.nextUrl.searchParams.get("callbackUrl");
  const safeCallbackUrl =
    callbackUrlParam &&
    callbackUrlParam.startsWith("/") &&
    !callbackUrlParam.startsWith("//") &&
    !callbackUrlParam.startsWith("/sign-in")
      ? callbackUrlParam
      : null;

  const publicPaths = ["/sign-in", "/forgot-password"];
  const excludedPaths = [
    "/_next/",
    "/favicon.ico",
    "/opengraph-image.jpg",
    "/opengraph-image.png",
    "/assets/",
  ];

  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  if (excludedPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const session = await auth();
  const accessToken = session?.user?.accessToken;
  const role = String(session?.user?.role || "").toLowerCase();
  const isAdminRole =
    role === "admin" || role === "superadmin" || role === "super_admin";

  if (pathname === "/") {
    if (accessToken && isAdminRole) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (pathname === "/sign-in" && accessToken && isAdminRole) {
    return NextResponse.redirect(
      new URL(safeCallbackUrl || "/dashboard", request.url),
    );
  }

  if (
    publicPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return NextResponse.next();
  }

  if (!session?.user || !accessToken || !isAdminRole) {
    const url = new URL("/sign-in", request.url);
    const requestUrl = `${pathname}${search}`;
    if (!requestUrl.startsWith("/sign-in")) {
      url.searchParams.set("callbackUrl", requestUrl);
    }
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|opengraph-image.jpg|opengraph-image.png|assets/).*)"],
};
