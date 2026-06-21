import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "未授权" }, { status: 401 });

    const currentUser = await prisma.user.findUnique({
      where: { username: session.user?.name || "" },
      include: { roles: { include: { role: true } } },
    });
    const isAdmin = currentUser?.roles.some((r) => r.role.code === "ADMIN");
    if (!isAdmin) return NextResponse.json({ error: "仅管理员可操作" }, { status: 403 });

    const form = await req.formData();
    const userId = String(form.get("userId") || "");
    if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });

    // 递增 sessionVersion → 所有已登录 session ≤60s 内自动失效
    await (prisma.user.update as any)({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    });

    return NextResponse.redirect(new URL("/admin/users?msg=logged_out", req.url));
  } catch (error) {
    console.error("强制登出失败:", error);
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
