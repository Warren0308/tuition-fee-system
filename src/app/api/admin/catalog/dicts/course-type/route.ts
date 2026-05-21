import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { name } = await req.json();
    
    if (!name) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }

    // 获取最大的 orderIndex
    const maxOrder = await prisma.courseType.findFirst({
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true }
    });

    // 创建新的课程类型
    await prisma.courseType.create({
      data: {
        name,
        orderIndex: (maxOrder?.orderIndex || 0) + 1
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("添加课程类型失败:", error);
    return NextResponse.json({ error: "添加失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id, name } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID 不能为空" }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const typeId = Number(id);
    const trimmedName = name.trim();

    const nameExists = await prisma.courseType.findFirst({
      where: { name: trimmedName, id: { not: typeId } },
    });
    if (nameExists) {
      return NextResponse.json({ error: "类型名称已存在" }, { status: 400 });
    }

    await prisma.courseType.update({
      where: { id: typeId },
      data: { name: trimmedName },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("更新课程类型失败:", error);
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

    const typeId = parseInt(id);

    // 检查是否有 Course 通过 CourseDict 引用此类型
    const dictWithCourses = await prisma.courseDict.findMany({
      where: { typeId },
      include: { _count: { select: { courses: true } } },
    });

    const totalCourses = dictWithCourses.reduce((sum, d) => sum + d._count.courses, 0);
    if (totalCourses > 0) {
      return NextResponse.json({
        error: `该课程类型下有 ${totalCourses} 门课程在使用，请先处理这些课程`,
      }, { status: 400 });
    }

    await prisma.courseType.delete({
      where: { id: typeId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("删除课程类型失败:", error);
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "无法删除：存在关联数据" }, { status: 400 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}







