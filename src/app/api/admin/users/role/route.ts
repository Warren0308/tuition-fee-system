import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const form = await req.formData();
    const userId = String(form.get("userId") || "");
    const roleCode = String(form.get("roleCode") || "").trim();
    const action = String(form.get("_action") || "change");

    if (!userId || !roleCode) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "用户不存在" }, { status: 404 });
    }

    const role = await prisma.role.findUnique({ where: { code: roleCode as any } });
    if (!role) {
      return NextResponse.json({ error: "角色不存在" }, { status: 400 });
    }

    if (action === "change") {
      await prisma.$transaction(async (tx) => {
        // 单一角色变更：先删除所有现有角色，再添加新角色
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.userRole.create({ data: { userId, roleId: role.id } });

        // 同步 Teacher 模型
        if (roleCode === 'TEACHER') {
          // 升级为教师 - 创建 Teacher 记录（如不存在）
          const existingTeacher = await tx.teacher.findUnique({
            where: { userId },
          });
          if (!existingTeacher) {
            await tx.teacher.create({
              data: {
                userId,
                name: user.username,
                email: user.email,
                phone: user.phone,
              },
            });
          }
        }
        // 注：从 TEACHER 角色降级时，保留 Teacher 历史数据，
        // 仅清空 userId 链接，避免外键约束
        else {
          const teacher = await tx.teacher.findUnique({ where: { userId } });
          if (teacher) {
            await tx.teacher.update({
              where: { id: teacher.id },
              data: { userId: null },
            });
          }
        }
      });
    }

    return NextResponse.redirect(new URL("/admin/users", req.url));
  } catch (error) {
    console.error("角色变更失败:", error);
    return NextResponse.json({ error: "角色变更失败" }, { status: 500 });
  }
}


