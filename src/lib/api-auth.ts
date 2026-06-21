import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * API 鉴权辅助函数 - 全项目统一入口
 */

export interface AuthSession {
  userId: string;
  username: string;
  roles: string[];
  isAdmin: boolean;
}

/** 统计分析：管理员与收费员可访问，老师不可见 */
export { canAccessStats, canAccessBilling, isTeacherOnly } from "@/lib/roles";

/**
 * 要求登录。未登录返回 401。
 */
export async function requireAuth(): Promise<
  { ok: true; session: AuthSession } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "未授权，请先登录" }, { status: 401 }),
    };
  }

  const roles = ((session as any).roles as string[]) || [];
  return {
    ok: true,
    session: {
      userId: (session as any).userId || "",
      username: session.user?.name || "",
      roles,
      isAdmin: roles.includes("ADMIN"),
    },
  };
}

/**
 * 要求管理员权限。非管理员返回 403。
 */
export async function requireAdmin(): Promise<
  { ok: true; session: AuthSession } | { ok: false; response: NextResponse }
> {
  const result = await requireAuth();
  if (!result.ok) return result;

  if (!result.session.isAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }),
    };
  }
  return result;
}

/**
 * 要求登录（带跳转重定向）。用于 form action 的端点。
 */
export async function requireAuthOrRedirect(req: Request): Promise<
  { ok: true; session: AuthSession } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    return {
      ok: false,
      response: NextResponse.redirect(loginUrl),
    };
  }
  const roles = ((session as any).roles as string[]) || [];
  return {
    ok: true,
    session: {
      userId: (session as any).userId || "",
      username: session.user?.name || "",
      roles,
      isAdmin: roles.includes("ADMIN"),
    },
  };
}
