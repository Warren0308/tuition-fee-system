import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { name, typeId } = await req.json();
    
    if (!name || !typeId) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    // 获取最大的 orderIndex
    const maxOrder = await prisma.courseDict.findFirst({
      where: { typeId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });

    // 创建新的课程
    await prisma.courseDict.create({
      data: {
        name,
        typeId,
        orderIndex: (maxOrder?.orderIndex || 0) + 1
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("添加课程失败:", error);
    return NextResponse.json({ error: "添加失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id, name, typeId } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID 不能为空" }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const dictId = Number(id);
    const trimmedName = name.trim();
    const updateData: any = { name: trimmedName };

    if (typeId !== undefined && typeId !== null) {
      const newTypeId = Number(typeId);
      if (isNaN(newTypeId)) {
        return NextResponse.json({ error: "类型ID无效" }, { status: 400 });
      }
      // 验证 type 存在
      const exists = await prisma.courseType.findUnique({ where: { id: newTypeId } });
      if (!exists) {
        return NextResponse.json({ error: "类型不存在" }, { status: 400 });
      }
      updateData.typeId = newTypeId;
    }

    await prisma.courseDict.update({
      where: { id: dictId },
      data: updateData,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新课程失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    const dictId = parseInt(id);

    // 检查是否有 Course 引用该字典
    const referenceCount = await prisma.course.count({ where: { dictId } });
    if (referenceCount > 0) {
      return NextResponse.json({
        error: `该课程字典正被 ${referenceCount} 门课程使用，请先删除或修改相关课程`,
      }, { status: 400 });
    }

    await prisma.courseDict.delete({
      where: { id: dictId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("删除课程失败:", error);
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "无法删除：存在关联数据" }, { status: 400 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}







