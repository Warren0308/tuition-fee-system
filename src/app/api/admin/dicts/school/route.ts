import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();

    if (!name) {
      return NextResponse.json({ error: "学校名称不能为空" }, { status: 400 });
    }

    const existing = await prisma.school.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "学校名称已存在" }, { status: 400 });
    }

    const created = await prisma.school.create({ data: { name } });
    await logAudit("School", "CREATE", { entityId: created.id, after: { name } });
    return NextResponse.redirect(new URL("/admin/catalog/dicts", req.url));
  } catch (error) {
    console.error("创建学校失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { id, name } = body;

    if (!id) {
      return NextResponse.json({ error: "ID 不能为空" }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: "学校名称不能为空" }, { status: 400 });
    }

    const schoolId = Number(id);
    const trimmedName = name.trim();

    const before = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!before) {
      return NextResponse.json({ error: "学校不存在" }, { status: 404 });
    }

    // 检查重名
    const nameExists = await prisma.school.findFirst({
      where: { name: trimmedName, id: { not: schoolId } },
    });
    if (nameExists) {
      return NextResponse.json({ error: "学校名称已存在" }, { status: 400 });
    }

    await prisma.school.update({
      where: { id: schoolId },
      data: { name: trimmedName },
    });

    await logAudit("School", "UPDATE", {
      entityId: schoolId,
      before: { name: before.name },
      after: { name: trimmedName },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("更新学校失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}


