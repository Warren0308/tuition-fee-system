import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
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

    // guardians up to 2
    for (const i of [1, 2]) {
      const name = String(form.get(`g${i}Name`) || "").trim();
      const typeIdRaw = String(form.get(`g${i}TypeId`) || "");
      const phone = String(form.get(`g${i}Phone`) || "").trim();
      const primary = Boolean(form.get(`g${i}Primary`));
      if (!name && !phone && !typeIdRaw) continue;
      const relationTypeId = typeIdRaw ? Number(typeIdRaw) : null;
      await tx.studentGuardian.create({
        data: {
          studentId: student.id,
          name,
          relationTypeId: relationTypeId!,
          phone,
          isPrimary: primary,
        },
      });
    }

    await tx.studentChangeLog.create({
      data: { studentId: student.id, action: "CREATE", after: { fullName, gradeId, schoolId, className, address } },
    });

    return student;
  });

  return NextResponse.redirect(new URL(`/students/${created.id}`, req.url));
}


