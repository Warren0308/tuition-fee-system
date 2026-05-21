import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions, isAccountActivated } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const form = await req.formData();
    const newPassword = String(form.get("newPassword") || "").trim();
    const confirmPassword = String(form.get("confirmPassword") || "").trim();

    // 验证
    if (!newPassword || !confirmPassword) {
      return NextResponse.json({ error: "请填写完整密码" }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "两次输入的密码不一致" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "密码至少需要6位" }, { status: 400 });
    }

    // 获取用户
    const user = await prisma.user.findUnique({
      where: { username: session.user.name }
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 检查新密码是否与用户名相同
    if (newPassword === user.username) {
      return NextResponse.json({ error: "新密码不能与用户名相同" }, { status: 400 });
    }

    // 更新密码
    const passwordHash = await bcrypt.hash(newPassword, 10);
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false
      }
    });

    // 检查是否满足激活条件
    const activated = isAccountActivated(updatedUser);
    
    if (activated && !updatedUser.isActive) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true }
      });
    }

    // 如果已完全激活，提示需要重新登录
    if (activated) {
      return NextResponse.redirect(new URL("/profile?activated=true", req.url));
    } else {
      return NextResponse.redirect(new URL("/profile?success=password", req.url));
    }
  } catch (error) {
    console.error("修改密码失败:", error);
    return NextResponse.json({ error: "修改密码失败" }, { status: 500 });
  }
}

