import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { username: session.user?.name || "" },
      include: { roles: { include: { role: true } } },
    });

    const isAdmin = currentUser?.roles.some((r) => r.role.code === "ADMIN");
    if (!isAdmin) {
      return NextResponse.json({ error: "只有管理员可以重置密码" }, { status: 403 });
    }

    const form = await req.formData();
    const userId = String(form.get("userId") || "");
    const newPassword = String(form.get("newPassword") || "").trim();

    if (!userId) return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
    if (!newPassword || newPassword.length < 4)
      return NextResponse.json({ error: "密码至少 4 位" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // 递增 sessionVersion → 所有已登录 session 在下次刷新时（≤60s）自动失效
    await (prisma.user.update as any)({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        isActive: true,
        sessionVersion: { increment: 1 },
      },
    });

    return NextResponse.redirect(new URL("/admin/users?msg=password_reset", req.url));
  } catch (error) {
    console.error("重置密码失败:", error);
    return NextResponse.json({ error: "重置密码失败" }, { status: 500 });
  }
}
