import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const form = await req.formData();
  const fullName = String(form.get("fullName") || "").trim();
  const gradeId = Number(form.get("gradeId"));
  const schoolIdRaw = String(form.get("schoolId") || "");
  const className = String(form.get("className") || "").trim();
  const address = String(form.get("address") || "").trim();

  if (!fullName || !gradeId) return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });

  const schoolId = schoolIdRaw ? Number(schoolIdRaw) : null;

  const created = await prisma.$transaction(async (tx) => {
    const student = await tx.student.create({
      data: { fullName, gradeId, schoolId: schoolId ?? undefined, className: className || null, address: address || null },
    });

    // 收集监护人（最多2个）并校验
    const guardiansToCreate: Array<{
      name: string;
      relationTypeId: number;
      phone: string;
      isPrimary: boolean;
    }> = [];

    for (const i of [1, 2]) {
      const name = String(form.get(`g${i}Name`) || "").trim();
      const typeIdRaw = String(form.get(`g${i}TypeId`) || "");
      const phone = String(form.get(`g${i}Phone`) || "").trim();
      const primary = Boolean(form.get(`g${i}Primary`));

      // 全为空，跳过
      if (!name && !phone && !typeIdRaw) continue;

      // 任何一项非空则要求完整
      if (!name || !phone || !typeIdRaw) {
        throw new Error(`监护人 ${i} 信息不完整：姓名、关系、电话都必须填写`);
      }

      const relationTypeId = Number(typeIdRaw);
      if (isNaN(relationTypeId)) {
        throw new Error(`监护人 ${i} 关系类型无效`);
      }

      guardiansToCreate.push({ name, relationTypeId, phone, isPrimary: primary });
    }

    // 确保最多一个主要联系人；若有监护人但都未勾选 primary，则第一个为主要
    const primaryCount = guardiansToCreate.filter((g) => g.isPrimary).length;
    if (primaryCount === 0 && guardiansToCreate.length > 0) {
      guardiansToCreate[0].isPrimary = true;
    } else if (primaryCount > 1) {
      // 只保留第一个为 primary
      let found = false;
      for (const g of guardiansToCreate) {
        if (g.isPrimary && !found) {
          found = true;
        } else {
          g.isPrimary = false;
        }
      }
    }

    for (const g of guardiansToCreate) {
      await tx.studentGuardian.create({
        data: { studentId: student.id, ...g },
      });
    }

    await tx.studentChangeLog.create({
      data: {
        studentId: student.id,
        action: "CREATE",
        after: {
          fullName,
          gradeId,
          schoolId,
          className,
          address,
          guardians: guardiansToCreate.map((g) => ({
            name: g.name,
            phone: g.phone,
            relationTypeId: g.relationTypeId,
            isPrimary: g.isPrimary,
          })),
        },
      },
    });

    return student;
  });

  return NextResponse.redirect(new URL(`/students/${created.id}`, req.url));
}


