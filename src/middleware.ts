import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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
    || pathname.startsWith("/schedule");

  if (!needsAuth) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  // 管理层保护
  if (ADMIN_PATHS.some(p => pathname === p || pathname.startsWith(p + "/"))) {
    const roles = (token as any).roles as string[] | undefined;
    if (!roles?.includes("ADMIN")) {
      return NextResponse.json({ ok: false, error: "无权访问" }, { status: 403 });
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
  ],
};


