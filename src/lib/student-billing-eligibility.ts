/**
 * 学生是否在指定期有应缴项目 — 全系统统一规则
 *
 * - 选课 / 额外费用：startTermId <= termId 且（无结束 或 endTermId >= termId）
 * - 第5期起应缴结构以第4期为准（见 fee-baseline.ts）
 * - 学生档案：isActive = true
 * - 「停止补习」= 将所有在读选课/额外费用设 endTermId = 最后一期就读
 */
import { prisma } from "@/lib/prisma";
import { getAcademicYearTerms, type AcademicTerm } from "@/lib/academic-year";
import {
  activeInTermWhere,
  activeInTermWhereForBilling,
} from "@/lib/fee-baseline";

export { activeInTermWhere } from "@/lib/fee-baseline";

/**
 * 查询在 billingTermId 仍有应缴项目的学生（待支付 / 批量结算 / 仪表板共用）
 *
 * 注意：这里用实际计费学期 billingTermId 来判断学生是否仍在读（选课/额外费用是否有效），
 * 而不是 fee_lookup_term（第5期起改为第4期）。fee_lookup_term 只用于查费用金额，
 * 不能用于判断学生是否已经停止补习。
 */
export function studentBillableInTermWhere(
  billingTermId: number,
  _terms?: AcademicTerm[]
) {
  const activeWhere = activeInTermWhere(billingTermId);
  return {
    isActive: true,
    OR: [
      { enrollments: { some: activeWhere } },
      { extraFees: { some: activeWhere } },
    ],
  };
}

export async function getStudentBillableInTermWhere(billingTermId: number) {
  const terms = await getAcademicYearTerms();
  return studentBillableInTermWhere(billingTermId, terms);
}

export type TutoringStatus =
  | { kind: "active" }
  | { kind: "stopped"; lastTermId: number; lastPeriod: number | null }
  | { kind: "none" };

type TermRef = { id: number; endTermId: number | null };
type TermWithPeriod = { id: number; period: number };

/** 根据选课/额外费用推断补习状态（用于 UI 展示） */
export function getTutoringStatus(
  enrollments: TermRef[],
  extraFees: TermRef[],
  terms: TermWithPeriod[]
): TutoringStatus {
  const hasOpen =
    enrollments.some((e) => !e.endTermId) || extraFees.some((f) => !f.endTermId);
  if (hasOpen) return { kind: "active" };

  const endIds = [
    ...enrollments.map((e) => e.endTermId),
    ...extraFees.map((f) => f.endTermId),
  ].filter((id): id is number => id != null);

  if (endIds.length === 0) return { kind: "none" };

  const lastTermId = Math.max(...endIds);
  const lastPeriod = terms.find((t) => t.id === lastTermId)?.period ?? null;
  return { kind: "stopped", lastTermId, lastPeriod };
}

/**
 * 停止补习：将所有在读（及结束晚于 lastTermId 的）选课与额外费用，
 * 统一设结束学期 = lastTermId（最后一期就读）
 */
export async function stopStudentTutoring(
  studentId: string,
  lastTermId: number
): Promise<{ enrollmentUpdates: number; extraFeeUpdates: number }> {
  const term = await prisma.term.findUnique({ where: { id: lastTermId } });
  if (!term) throw new Error("学期不存在");

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("学生不存在");

  const [enrollments, extraFees] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: {
        studentId,
        OR: [{ endTermId: null }, { endTermId: { gt: lastTermId } }],
      },
    }),
    prisma.studentExtraFee.findMany({
      where: {
        studentId,
        OR: [{ endTermId: null }, { endTermId: { gt: lastTermId } }],
      },
    }),
  ]);

  let enrollmentUpdates = 0;
  let extraFeeUpdates = 0;

  await prisma.$transaction(async (tx) => {
    for (const e of enrollments) {
      const endTermId = e.startTermId > lastTermId ? e.startTermId : lastTermId;
      await tx.studentEnrollment.update({
        where: { id: e.id },
        data: { endTermId },
      });
      enrollmentUpdates++;
    }
    for (const f of extraFees) {
      const endTermId = f.startTermId > lastTermId ? f.startTermId : lastTermId;
      await tx.studentExtraFee.update({
        where: { id: f.id },
        data: { endTermId },
      });
      extraFeeUpdates++;
    }

    await tx.studentChangeLog.create({
      data: {
        studentId,
        action: "STOP_TUTORING",
        before: {
          openEnrollments: enrollments.filter((e) => !e.endTermId).length,
          openExtraFees: extraFees.filter((f) => !f.endTermId).length,
        },
        after: {
          lastTermId,
          lastTerm: `${term.year}T${term.termIndex}`,
          enrollmentUpdates,
          extraFeeUpdates,
        },
      },
    });
  });

  return { enrollmentUpdates, extraFeeUpdates };
}

/** 恢复在读：清除所有结束学期不早于 fromTermId 的 endTermId */
export async function resumeStudentTutoring(
  studentId: string,
  fromTermId?: number
): Promise<{ enrollmentUpdates: number; extraFeeUpdates: number }> {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("学生不存在");

  const enrollmentWhere = fromTermId
    ? { studentId, endTermId: { gte: fromTermId } }
    : { studentId, endTermId: { not: null } };
  const extraFeeWhere = fromTermId
    ? { studentId, endTermId: { gte: fromTermId } }
    : { studentId, endTermId: { not: null } };

  const [enrollments, extraFees] = await Promise.all([
    prisma.studentEnrollment.findMany({ where: enrollmentWhere }),
    prisma.studentExtraFee.findMany({ where: extraFeeWhere }),
  ]);

  await prisma.$transaction(async (tx) => {
    for (const e of enrollments) {
      await tx.studentEnrollment.update({
        where: { id: e.id },
        data: { endTermId: null },
      });
    }
    for (const f of extraFees) {
      await tx.studentExtraFee.update({
        where: { id: f.id },
        data: { endTermId: null },
      });
    }
    await tx.studentChangeLog.create({
      data: {
        studentId,
        action: "RESUME_TUTORING",
        after: {
          enrollmentUpdates: enrollments.length,
          extraFeeUpdates: extraFees.length,
          fromTermId: fromTermId ?? null,
        },
      },
    });
  });

  return {
    enrollmentUpdates: enrollments.length,
    extraFeeUpdates: extraFees.length,
  };
}

export function formatTutoringStatusLabel(
  status: TutoringStatus,
  terms?: AcademicTerm[]
): string | null {
  if (status.kind === "active") return null;
  if (status.kind === "none") return "暂无选课";
  if (status.lastPeriod != null) return `已于第${status.lastPeriod}期停止补习`;
  if (terms) {
    const t = terms.find((x) => x.id === status.lastTermId);
    if (t) return `已于第${t.period}期停止补习`;
  }
  return "已停止补习";
}
