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

    // 检查是否为管理员
    const currentUser = await prisma.user.findUnique({
      where: { username: session.user?.name || '' },
      include: { roles: { include: { role: true } } }
    });
    
    const isAdmin = currentUser?.roles.some(r => r.role.code === 'ADMIN');
    if (!isAdmin) {
      return NextResponse.json({ error: "只有管理员可以重置密码" }, { status: 403 });
    }

    const form = await req.formData();
    const userId = String(form.get("userId") || "");

    if (!userId) {
      return NextResponse.json({ error: "缺少用户ID" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 重置密码为用户名
    const passwordHash = await bcrypt.hash(user.username, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        isActive: false  // 重置后需要重新激活
      }
    });

    return NextResponse.json({ ok: true, message: "密码已重置为用户名" });
  } catch (error) {
    console.error("重置密码失败:", error);
    return NextResponse.json({ error: "重置密码失败" }, { status: 500 });
  }
}






