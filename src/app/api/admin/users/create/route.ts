import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const form = await req.formData();
    const username = String(form.get("username") || "").trim();
    const roleCode = String(form.get("roleCode") || "").trim();
    
    if (!username || !roleCode) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    // 用户名格式验证：只允许字母、数字、下划线
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json({ error: "用户名只能包含字母、数字和下划线" }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 400 });
    }

    const role = await prisma.role.findUnique({ where: { code: roleCode as any } });
    if (!role) {
      return NextResponse.json({ error: "角色不存在" }, { status: 400 });
    }

    // 密码 = 用户名（初始密码）
    const passwordHash = await bcrypt.hash(username, 10);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          passwordHash,
          isActive: false,           // 创建后默认不启用
          mustChangePassword: true,  // 首次登录必须改密码
          roles: { create: [{ roleId: role.id }] },
        },
      });

      // 如果是 TEACHER 角色，同步创建 Teacher 记录
      if (roleCode === 'TEACHER') {
        await tx.teacher.create({
          data: {
            userId: user.id,
            name: username,
          },
        });
      }
    });

    return NextResponse.redirect(new URL("/admin/users", req.url));
  } catch (error) {
    console.error("用户创建失败:", error);
    return NextResponse.json({ error: "用户创建失败" }, { status: 500 });
  }
}


