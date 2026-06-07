import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect } from "@/lib/api-auth";

/**
 * 监护人管理（在学生下）
 * POST: 添加监护人
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const studentId = params.id;
  const form = await req.formData();
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
    return NextResponse.json(
      { ok: false, error: "关系类型无效" },
      { status: 400 }
    );
  }

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) {
    return NextResponse.json({ ok: false, error: "学生不存在" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.studentGuardian.updateMany({
          where: { studentId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await tx.studentGuardian.create({
        data: { studentId, name, relationTypeId, phone, isPrimary },
      });

      await tx.studentChangeLog.create({
        data: {
          studentId,
          action: "GUARDIAN_ADD",
          after: {
            guardianId: created.id,
            name,
            phone,
            relationTypeId,
            isPrimary,
          },
        },
      });
    });

    return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
  } catch (e) {
    console.error("添加监护人失败:", e);
    return NextResponse.json({ ok: false, error: "添加失败" }, { status: 500 });
  }
}
