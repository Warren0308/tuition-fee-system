import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const name = String(form.get("name") || "").trim();

    if (!name) {
      return NextResponse.json({ error: "监护人关系名称不能为空" }, { status: 400 });
    }

    const existing = await prisma.guardianType.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "监护人关系名称已存在" }, { status: 400 });
    }

    await prisma.guardianType.create({ data: { name } });
    return NextResponse.redirect(new URL("/admin/catalog/dicts", req.url));
  } catch (error) {
    console.error("创建监护人关系失败:", error);
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
      return NextResponse.json({ error: "名称不能为空" }, { status: 400 });
    }

    const typeId = Number(id);
    const trimmedName = name.trim();

    const nameExists = await prisma.guardianType.findFirst({
      where: { name: trimmedName, id: { not: typeId } },
    });
    if (nameExists) {
      return NextResponse.json({ error: "关系名称已存在" }, { status: 400 });
    }

    await prisma.guardianType.update({
      where: { id: typeId },
      data: { name: trimmedName },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("更新监护人关系失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}


