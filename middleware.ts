import type {
  NextFetchEvent,
  NextMiddleware,
  NextRequest,
} from "next/server";
import type { NextAuthRequest } from "next-auth";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import { SESSION_EXPIRED_ERROR } from "./lib/authTokenState";

const publicPaths = ["/sign-in", "/forgot-password"];
const excludedPrefixes = [
  "/_next/",
  "/favicon.ico",
  "/opengraph-image.jpg",
  "/opengraph-image.png",
  "/assets/",
];

const safeCallbackUrl = (request: NextAuthRequest) => {
  const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
  return callbackUrl &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    !callbackUrl.startsWith("/sign-in")
    ? callbackUrl
    : null;
};

const handleAuthenticatedRequest = (
  request: NextAuthRequest,
  event: NextFetchEvent,
): ReturnType<NextMiddleware> => {
  void event;
  const { pathname, search } = request.nextUrl;
  const sessionExpired =
    request.auth?.authError === SESSION_EXPIRED_ERROR;
  const backendAccessExpired =
    request.auth?.backendAccessExpired === true;
  const isAuthenticated = Boolean(request.auth?.user) && !sessionExpired;
  const role = String(request.auth?.user?.role || "").toLowerCase();
  const isAdminRole =
    role === "admin" || role === "superadmin" || role === "super_admin";

  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(
        isAuthenticated && isAdminRole ? "/dashboard" : "/sign-in",
        request.url,
      ),
    );
  }

  if (pathname === "/sign-in" && isAuthenticated && isAdminRole) {
    return NextResponse.redirect(
      new URL(safeCallbackUrl(request) || "/dashboard", request.url),
    );
  }

  if (pathname === "/sign-up") {
    return NextResponse.redirect(
      new URL(
        isAuthenticated && isAdminRole ? "/dashboard" : "/sign-in",
        request.url,
      ),
    );
  }

  if (
    publicPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return NextResponse.next();
  }

  if (!isAuthenticated || !isAdminRole) {
    const url = new URL("/sign-in", request.url);
    const requestUrl = `${pathname}${search}`;
    if (!requestUrl.startsWith("/sign-in")) {
      url.searchParams.set("callbackUrl", requestUrl);
    }
    if (sessionExpired) url.searchParams.set("reason", "session-expired");
    return NextResponse.redirect(url);
  }

  if (
    backendAccessExpired &&
    (request.method === "GET" || request.method === "HEAD")
  ) {
    const refreshUrl = new URL("/api/auth/refresh-session", request.url);
    refreshUrl.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(refreshUrl);
  }

  return NextResponse.next();
};

const withAuth = auth(handleAuthenticatedRequest);

export function middleware(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/api/auth/") ||
    excludedPrefixes.some((prefix) => pathname.startsWith(prefix))
  ) {
    return NextResponse.next();
  }
  return withAuth(request, event);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|opengraph-image.jpg|opengraph-image.png|assets/).*)",
  ],
};

export default middleware;
