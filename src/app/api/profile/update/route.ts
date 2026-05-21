import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions, isAccountActivated } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.name) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const form = await req.formData();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();

    if (!email || !phone) {
      return NextResponse.json({ error: "邮箱和电话是必填项" }, { status: 400 });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }

    // 获取用户
    const user = await prisma.user.findUnique({
      where: { username: session.user.name }
    });

    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    // 检查邮箱是否已被其他用户使用
    const existingEmail = await prisma.user.findFirst({
      where: { 
        email,
        id: { not: user.id }
      }
    });

    if (existingEmail) {
      return NextResponse.json({ error: "该邮箱已被其他用户使用" }, { status: 400 });
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        phone
      }
    });

    // 检查是否满足激活条件，如果满足则自动激活
    if (isAccountActivated(updatedUser) && !updatedUser.isActive) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true }
      });
    }

    // 如果是老师角色，同时更新teacher记录
    const userRoles = await prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true }
    });

    if (userRoles.some(r => r.role.code === 'TEACHER')) {
      const existingTeacher = await prisma.teacher.findFirst({
        where: { userId: user.id }
      });

      if (existingTeacher) {
        await prisma.teacher.update({
          where: { id: existingTeacher.id },
          data: { email, phone }
        });
      } else {
        await prisma.teacher.create({
          data: {
            userId: user.id,
            name: user.username,
            email,
            phone
          }
        });
      }
    }

    // 判断是否已激活
    const finalUser = await prisma.user.findUnique({ where: { id: user.id } });
    const activated = finalUser && isAccountActivated(finalUser);

    if (activated) {
      // 资料已完善，需要重新登录以刷新 session
      return NextResponse.redirect(new URL("/profile?activated=true", req.url));
    } else {
      return NextResponse.redirect(new URL("/profile?success=info", req.url));
    }
  } catch (error) {
    console.error("个人资料更新失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
