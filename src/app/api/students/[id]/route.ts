import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect, requireAdmin } from "@/lib/api-auth";
import { parseLocalDate } from "@/lib/date-utils";

/**
 * 学生资料更新 / 删除（停用） API
 * 
 * POST + _method=PATCH  -> 更新
 * POST + _method=DELETE -> 停用（软删）
 * POST + _method=RESTORE -> 启用
 */

function diffFields<T extends Record<string, any>>(before: T, after: T): Record<string, { old: any; new: any }> {
  const changes: Record<string, { old: any; new: any }> = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      changes[key] = { old: before[key], new: after[key] };
    }
  }
  return changes;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const studentId = params.id;
  const form = await req.formData();
  const method = String(form.get("_method") || "PATCH").toUpperCase();

  const existing = await prisma.student.findUnique({ where: { id: studentId } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "学生不存在" }, { status: 404 });
  }

  if (method === "DELETE" || method === "RESTORE") {
    // 软删 / 恢复 - 需要管理员
    if (!auth.session.isAdmin) {
      return NextResponse.json({ ok: false, error: "需要管理员权限" }, { status: 403 });
    }

    const newActive = method === "RESTORE";
    await prisma.student.update({
      where: { id: studentId },
      data: { isActive: newActive },
    });

    await prisma.studentChangeLog.create({
      data: {
        studentId,
        action: newActive ? "RESTORE" : "DEACTIVATE",
        before: { isActive: existing.isActive },
        after: { isActive: newActive },
      },
    });

    return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
  }

  // PATCH 更新
  const fullName = String(form.get("fullName") || "").trim();
  const gradeId = Number(form.get("gradeId"));
  const schoolIdRaw = String(form.get("schoolId") || "");
  const className = String(form.get("className") || "").trim();
  const address = String(form.get("address") || "").trim();
  const address2 = String(form.get("address2") || "").trim();
  const city = String(form.get("city") || "").trim();
  const state = String(form.get("state") || "").trim();
  const postcode = String(form.get("postcode") || "").trim();
  const gender = String(form.get("gender") || "").trim();
  const dobRaw = String(form.get("dateOfBirth") || "").trim();

  if (!fullName || !gradeId) {
    return NextResponse.json(
      { ok: false, error: "姓名和年级必填" },
      { status: 400 }
    );
  }

  const updateData: any = {
    fullName,
    gradeId,
    schoolId: schoolIdRaw ? Number(schoolIdRaw) : null,
    className: className || null,
    address: address || null,
    address2: address2 || null,
    city: city || null,
    state: state || null,
    postcode: postcode || null,
    gender: gender === "MALE" || gender === "FEMALE" ? gender : null,
    dateOfBirth: dobRaw ? parseLocalDate(dobRaw) : null,
  };

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: { id: studentId },
      data: updateData,
    });

    // 计算差异写入 ChangeLog
    const beforeForLog = {
      fullName: existing.fullName,
      gradeId: existing.gradeId,
      schoolId: existing.schoolId,
      className: existing.className,
      address: existing.address,
      address2: existing.address2,
      city: existing.city,
      state: existing.state,
      postcode: existing.postcode,
      gender: existing.gender,
      dateOfBirth: existing.dateOfBirth?.toISOString() || null,
    };
    const afterForLog = {
      ...updateData,
      dateOfBirth: updateData.dateOfBirth?.toISOString() || null,
    };
    const changes = diffFields(beforeForLog, afterForLog);

    if (Object.keys(changes).length > 0) {
      await tx.studentChangeLog.create({
        data: {
          studentId,
          action: "UPDATE",
          before: beforeForLog,
          after: afterForLog,
        },
      });
    }
  });

  return NextResponse.redirect(new URL(`/students/${studentId}`, req.url));
}
