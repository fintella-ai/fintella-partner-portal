import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// OpCenter (opcenter.app) embeds this portal in an iframe. There was
// previously no frame-ancestors/X-Frame-Options restriction at all — any
// site could iframe the login page. Now that cookies are SameSite=None for
// cross-site delivery (see src/lib/auth.ts), scope framing to the one
// trusted embedder instead of leaving it wide open.
const FRAME_ANCESTORS = "frame-ancestors 'self' https://opcenter.app";

function withFrameAncestors(res: NextResponse) {
  res.headers.set("Content-Security-Policy", FRAME_ANCESTORS);
  return res;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Public pages — accessible to anyone, no redirects
  if (pathname.startsWith("/docs/") || pathname.startsWith("/signup") || pathname.startsWith("/impersonate") || pathname.startsWith("/getstarted") || pathname === "/privacy" || pathname === "/terms" || pathname === "/sms-terms" || pathname === "/forgot-password" || pathname === "/reset-password" || pathname === "/mfa-recovery" || pathname === "/apply" || pathname === "/booker" || pathname === "/landing-v2" || pathname.startsWith("/recover") || pathname.startsWith("/partners") || pathname.startsWith("/webinar") || pathname === "/unsubscribe" || pathname.startsWith("/widget") || pathname.startsWith("/calculator") || pathname === "/pricing" || pathname.startsWith("/intake")) {
    return withFrameAncestors(NextResponse.next());
  }

  // Public routes (login, home)
  if (pathname === "/login" || pathname === "/" || pathname.startsWith("/api/auth")) {
    // If already logged in, redirect to appropriate dashboard
    if (session?.user) {
      const role = (session.user as any).role;
      if (["admin", "super_admin", "accounting", "partner_support"].includes(role)) {
        // /admin is the workspace dashboard (previously we landed on
        // /admin/partners). The sidebar's Home entry points here too.
        return withFrameAncestors(NextResponse.redirect(new URL("/admin", req.url)));
      }
      return withFrameAncestors(NextResponse.redirect(new URL("/dashboard/home", req.url)));
    }
    return withFrameAncestors(NextResponse.next());
  }

  // Protected routes — require auth
  if (!session?.user) {
    return withFrameAncestors(NextResponse.redirect(new URL("/login", req.url)));
  }

  // Ops Center — any authenticated user (admin or partner) can access
  // No additional role gate needed; the auth check above suffices.
  if (pathname === "/ops" || pathname.startsWith("/ops/")) {
    return withFrameAncestors(NextResponse.next());
  }

  // Admin-only routes
  if (pathname.startsWith("/admin")) {
    const role = (session.user as any).role;
    if (!["admin", "super_admin", "accounting", "partner_support"].includes(role)) {
      return withFrameAncestors(NextResponse.redirect(new URL("/dashboard/home", req.url)));
    }
  }

  return withFrameAncestors(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api).*)",
  ],
};
