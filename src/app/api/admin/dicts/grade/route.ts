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
    const orderIndex = Number(form.get("orderIndex") || 0);
    
    if (!name) {
      return NextResponse.json({ error: "年级名称不能为空" }, { status: 400 });
    }

    // 检查是否已存在
    const existing = await prisma.grade.findUnique({
      where: { name }
    });
    
    if (existing) {
      return NextResponse.json({ error: "年级名称已存在" }, { status: 400 });
    }

    // 检查是否有相同排序号
    const existingOrder = await prisma.grade.findFirst({
      where: { orderIndex }
    });

    if (existingOrder) {
      // 将现有的排序号往后移
      await prisma.grade.updateMany({
        where: { orderIndex: { gte: orderIndex } },
        data: { orderIndex: { increment: 1 } }
      });
    }

    await prisma.grade.create({ data: { name, orderIndex } });
    return NextResponse.redirect(new URL("/admin/catalog/dicts", req.url));
  } catch (error) {
    console.error("创建年级失败:", error);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { id, name, orderIndex } = body;

    if (!id) {
      return NextResponse.json({ error: "ID 不能为空" }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const gradeId = Number(id);
    const targetOrder = Number(orderIndex);

    // 检查名称是否被其他年级占用
    const nameExists = await prisma.grade.findFirst({
      where: { name: name.trim(), id: { not: gradeId } },
    });
    if (nameExists) {
      return NextResponse.json({ error: "年级名称已存在" }, { status: 400 });
    }

    // 检查 orderIndex 是否被占用
    if (!isNaN(targetOrder)) {
      const orderExists = await prisma.grade.findFirst({
        where: { orderIndex: targetOrder, id: { not: gradeId } },
      });
      if (orderExists) {
        // 把占用者往后推
        await prisma.grade.updateMany({
          where: { orderIndex: { gte: targetOrder }, id: { not: gradeId } },
          data: { orderIndex: { increment: 1 } },
        });
      }
    }

    const before = await prisma.grade.findUnique({ where: { id: gradeId } });

    await prisma.grade.update({
      where: { id: gradeId },
      data: {
        name: name.trim(),
        ...(isNaN(targetOrder) ? {} : { orderIndex: targetOrder }),
      },
    });

    await logAudit("Grade", "UPDATE", {
      entityId: gradeId,
      before: { name: before?.name, orderIndex: before?.orderIndex },
      after: { name: name.trim(), orderIndex: isNaN(targetOrder) ? before?.orderIndex : targetOrder },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("更新年级失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}


