import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim() || null;
    const phone = String(form.get("phone") || "").trim() || null;
    const userId = String(form.get("userId") || "").trim() || null;

    if (!name) {
      return NextResponse.json({ error: "教师姓名不能为空" }, { status: 400 });
    }

    // 检查 userId 是否已绑定
    if (userId) {
      const existing = await prisma.teacher.findUnique({ where: { userId } });
      if (existing) {
        return NextResponse.json(
          { error: "该用户已绑定到其他教师记录" },
          { status: 400 }
        );
      }
    }

    const teacher = await prisma.teacher.create({
      data: { name, email, phone, userId },
    });

    return NextResponse.redirect(new URL(`/teachers/${teacher.id}`, req.url));
  } catch (error: any) {
    console.error("创建教师失败:", error);
    return NextResponse.json(
      { error: error.message || "创建失败" },
      { status: 500 }
    );
  }
}
