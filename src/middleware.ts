import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessBilling, canAccessStats } from "@/lib/roles";

const ADMIN_PATHS = ["/admin", "/admin/terms", "/admin/catalog", "/admin/catalog/fees", "/admin/catalog/extras", "/admin/users", "/admin/reports"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 保护需要登录的路由
  const needsAuth = pathname.startsWith("/dashboard")
    || pathname.startsWith("/students")
    || pathname.startsWith("/teachers")
    || pathname.startsWith("/profile")
    || pathname.startsWith("/billing")
    || pathname.startsWith("/admin")
    || pathname.startsWith("/search")
    || pathname.startsWith("/schedule")
    || pathname.startsWith("/stats");

  if (!needsAuth) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  const roles = (token as any).roles as string[] | undefined;

  // 管理层保护
  if (ADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    if (!roles?.includes("ADMIN")) {
      return NextResponse.json({ ok: false, error: "无权访问" }, { status: 403 });
    }
  }

  // 统计分析：仅管理员可访问（收费员、老师均不可）
  if (pathname === "/stats" || pathname.startsWith("/stats/")) {
    if (!canAccessStats(roles ?? [])) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // 缴费/结算：仅老师不可访问（管理员、收费员正常）
  if (pathname.startsWith("/billing")) {
    if (!canAccessBilling(roles ?? [])) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/students/:path*",
    "/teachers/:path*",
    "/profile/:path*",
    "/billing/:path*",
    "/admin/:path*",
    "/search",
    "/schedule/:path*",
    "/stats/:path*",
    "/stats",
  ],
};


