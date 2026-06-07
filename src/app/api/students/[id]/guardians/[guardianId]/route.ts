import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect } from "@/lib/api-auth";

/**
 * 单个监护人的修改 / 删除
 *
 * POST + _method=PATCH  -> 更新
 * POST + _method=DELETE -> 删除
 * POST + _method=PRIMARY -> 设为主要联系人
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; guardianId: string } }
) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const studentId = params.id;
  const guardianId = Number(params.guardianId);
  if (isNaN(guardianId)) {
    return NextResponse.json({ ok: false, error: "监护人ID无效" }, { status: 400 });
  }

  const form = await req.formData();
  const method = String(form.get("_method") || "PATCH").toUpperCase();

  const existing = await prisma.studentGuardian.findUnique({
    where: { id: guardianId },
  });
  if (!existing || existing.studentId !== studentId) {
    return NextResponse.json({ ok: false, error: "监护人不存在" }, { status: 404 });
  }

  try {
    if (method === "DELETE") {
      await prisma.$transaction(async (tx) => {
        await tx.studentGuardian.delete({ where: { id: guardianId } });
        await tx.studentChangeLog.create({
          data: {
            studentId,
            action: "GUARDIAN_REMOVE",
            before: {
              guardianId,
              name: existing.name,
              phone: existing.phone,
              isPrimary: existing.isPrimary,
            },
          },
        });
      });
      return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
    }

    if (method === "PRIMARY") {
      await prisma.$transaction(async (tx) => {
        await tx.studentGuardian.updateMany({
          where: { studentId, isPrimary: true },
          data: { isPrimary: false },
        });
        await tx.studentGuardian.update({
          where: { id: guardianId },
          data: { isPrimary: true },
        });
        await tx.studentChangeLog.create({
          data: {
            studentId,
            action: "GUARDIAN_SET_PRIMARY",
            before: { guardianId, isPrimary: existing.isPrimary },
            after: { guardianId, isPrimary: true },
          },
        });
      });
      return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
    }

    // PATCH 更新
    const name = String(form.get("name") || "").trim();
    const relationTypeIdRaw = String(form.get("relationTypeId") || "");
    const phone = String(form.get("phone") || "").trim();
    const isPrimary = Boolean(form.get("isPrimary"));

    if (!name || !phone || !relationTypeIdRaw) {
      return NextResponse.json(
        { ok: false, error: "姓名、关系、电话都必须填写" },
        { status: 400 }
      );
    }

    const relationTypeId = Number(relationTypeIdRaw);
    if (isNaN(relationTypeId)) {
      return NextResponse.json({ ok: false, error: "关系类型无效" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (isPrimary && !existing.isPrimary) {
        await tx.studentGuardian.updateMany({
          where: { studentId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      await tx.studentGuardian.update({
        where: { id: guardianId },
        data: { name, relationTypeId, phone, isPrimary },
      });

      await tx.studentChangeLog.create({
        data: {
          studentId,
          action: "GUARDIAN_UPDATE",
          before: {
            guardianId,
            name: existing.name,
            phone: existing.phone,
            relationTypeId: existing.relationTypeId,
            isPrimary: existing.isPrimary,
          },
          after: { guardianId, name, phone, relationTypeId, isPrimary },
        },
      });
    });

    return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
  } catch (e) {
    console.error("监护人操作失败:", e);
    return NextResponse.json({ ok: false, error: "操作失败" }, { status: 500 });
  }
}
