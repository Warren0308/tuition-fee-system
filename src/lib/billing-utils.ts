import { prisma } from "@/lib/prisma";
import {
  getAcademicYearTerms,
  getCurrentAcademicTerm,
  type AcademicTerm,
} from "@/lib/academic-year";
import {
  activeInTermWhere,
  resolveFeeLookupTermId,
} from "@/lib/fee-baseline";
import { isTermForceClosedByTermId } from "@/lib/term-force-close";

/**
 * 账单/费用结算相关的公共工具函数
 * 统一全项目的「待支付」「应缴」「实缴」计算逻辑
 */

// 视为「已包含 extraFee」的 itemType（包含正式注册和临时勾选）
export const EXTRA_FEE_PAID_TYPES = ['EXTRA_FEE', 'TEMP_EXTRA_FEE'];

// 已支付的课程类型
export const COURSE_PAID_TYPES = ['COURSE'];

export interface UnpaidItem {
  type: 'COURSE' | 'EXTRA_FEE';
  refId: number;
  name: string;
  code?: string;
  price: number;
}

export interface UnpaidSummary {
  unpaidCourses: UnpaidItem[];
  unpaidExtraFees: UnpaidItem[];
  unpaidTotal: number;
  hasAnyEnrollment: boolean;
}

/**
 * 计算单个学生在指定学期的未支付项目
 * 
 * 算法：
 * 1. 找出该学期有效的选课和已注册额外费用（应缴项目）
 * 2. 找出该学期账单中已包含的项目（已缴项目）
 * 3. 应缴 - 已缴 = 未缴
 * 
 * 注意：
 * - TEMP_EXTRA_FEE 视为已支付该 extraFeeType 的临时方式
 * - CUSTOM_FEE 不参与对比（无 refId）
 */
export async function calculateUnpaidForStudent(
  studentId: string,
  termId: number,
  gradeId: number
): Promise<UnpaidSummary> {
  if (await isTermForceClosedByTermId(studentId, termId)) {
    return {
      unpaidCourses: [],
      unpaidExtraFees: [],
      unpaidTotal: 0,
      hasAnyEnrollment: false,
    };
  }

  const terms = await getAcademicYearTerms();
  const feeTermId = resolveFeeLookupTermId(termId, terms);

  // 并行获取：选课、额外费用（应缴结构）、账单（当期实缴）
  const [enrollments, extraFees, payment] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where: {
        studentId,
        ...activeInTermWhere(feeTermId),
      },
      include: {
        course: { include: { fees: true } },
      },
    }),
    prisma.studentExtraFee.findMany({
      where: {
        studentId,
        ...activeInTermWhere(feeTermId),
      },
      include: { extraFeeType: true },
    }),
    prisma.studentTermPayment.findFirst({
      where: { studentId, term: { id: termId } },
      include: { items: true },
    }),
  ]);

  // 已在账单中的课程/额外费用 ID
  const paidCourseIds = new Set(
    payment?.items
      .filter((i) => COURSE_PAID_TYPES.includes(i.itemType) && i.refId)
      .map((i) => i.refId!) || []
  );

  const paidExtraFeeTypeIds = new Set(
    payment?.items
      .filter((i) => EXTRA_FEE_PAID_TYPES.includes(i.itemType) && i.refId)
      .map((i) => i.refId!) || []
  );

  // 未支付课程
  const unpaidCourses: UnpaidItem[] = [];
  for (const en of enrollments) {
    if (paidCourseIds.has(en.courseId)) continue;

    // 优先使用 enrollment 自定义价 -> CourseFee -> 默认 0
    const fee = en.course.fees?.find((f) => f.gradeId === gradeId);
    const price = en.customPriceCents ?? fee?.amountCents ?? 0;

    unpaidCourses.push({
      type: 'COURSE',
      refId: en.courseId,
      name: en.course.name,
      code: en.course.code,
      price,
    });
  }

  // 未支付额外费用
  const unpaidExtraFees: UnpaidItem[] = [];
  for (const ef of extraFees) {
    if (paidExtraFeeTypeIds.has(ef.extraFeeTypeId)) continue;
    unpaidExtraFees.push({
      type: 'EXTRA_FEE',
      refId: ef.extraFeeTypeId,
      name: ef.extraFeeType.name,
      code: ef.extraFeeType.code,
      price: ef.amountCents,
    });
  }

  const unpaidTotal =
    unpaidCourses.reduce((s, i) => s + i.price, 0) +
    unpaidExtraFees.reduce((s, i) => s + i.price, 0);

  return {
    unpaidCourses,
    unpaidExtraFees,
    unpaidTotal,
    hasAnyEnrollment: enrollments.length > 0 || extraFees.length > 0,
  };
}

/**
 * 获取当前学期 — 仅限本学年（学期管理生成的 13 期）
 */
export async function getCurrentOrLatestTerm(): Promise<AcademicTerm | null> {
  return getCurrentAcademicTerm();
}

/** 2026 学年内，该学生第一个仍有欠费的学期 */
export async function findFirstUnpaidTermForStudent(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { gradeId: true },
  });
  if (!student) return null;

  const terms = await getAcademicYearTerms();

  for (const term of terms) {
    const summary = await calculateUnpaidForStudent(studentId, term.id, student.gradeId);
    if (summary.unpaidTotal > 0) return term;
  }
  return null;
}

/**
 * 解析结算页应使用的学期：未指定参数时优先跳到第一个欠费期
 */
export async function resolveBillingTerm(
  studentId: string,
  year?: number,
  termIndex?: number
) {
  if (year && termIndex) {
    const terms = await getAcademicYearTerms();
    const fromAcademic = terms.find(
      (t) => t.year === year && t.termIndex === termIndex
    );
    if (fromAcademic) return fromAcademic;
    return prisma.term.findFirst({ where: { year, termIndex } });
  }

  const firstUnpaid = await findFirstUnpaidTermForStudent(studentId);
  if (firstUnpaid) return firstUnpaid;

  return getCurrentOrLatestTerm();
}

/**
 * 批量计算多个学生的待支付情况
 * 比逐个调用 calculateUnpaidForStudent 高效
 */
export async function calculateUnpaidForStudents(
  studentIds: string[],
  termId: number
): Promise<Map<string, UnpaidSummary>> {
  const result = new Map<string, UnpaidSummary>();

  if (studentIds.length === 0) return result;

  const terms = await getAcademicYearTerms();
  const feeTermId = resolveFeeLookupTermId(termId, terms);

  // 一次性查询所有需要的数据
  const [students, enrollments, extraFees, payments] = await Promise.all([
    prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, gradeId: true },
    }),
    prisma.studentEnrollment.findMany({
      where: {
        studentId: { in: studentIds },
        ...activeInTermWhere(feeTermId),
      },
      include: { course: { include: { fees: true } } },
    }),
    prisma.studentExtraFee.findMany({
      where: {
        studentId: { in: studentIds },
        ...activeInTermWhere(feeTermId),
      },
      include: { extraFeeType: true },
    }),
    prisma.studentTermPayment.findMany({
      where: { studentId: { in: studentIds }, term: { id: termId } },
      include: { items: true },
    }),
  ]);

  // 索引
  const gradeByStudent = new Map(students.map((s) => [s.id, s.gradeId]));
  const enByStudent = new Map<string, typeof enrollments>();
  const efByStudent = new Map<string, typeof extraFees>();
  const payByStudent = new Map<string, (typeof payments)[number]>();

  for (const en of enrollments) {
    if (!enByStudent.has(en.studentId)) enByStudent.set(en.studentId, []);
    enByStudent.get(en.studentId)!.push(en);
  }
  for (const ef of extraFees) {
    if (!efByStudent.has(ef.studentId)) efByStudent.set(ef.studentId, []);
    efByStudent.get(ef.studentId)!.push(ef);
  }
  for (const p of payments) {
    payByStudent.set(p.studentId, p);
  }

  for (const sid of studentIds) {
    const gradeId = gradeByStudent.get(sid);
    if (gradeId === undefined) continue;

    const ens = enByStudent.get(sid) || [];
    const efs = efByStudent.get(sid) || [];
    const payment = payByStudent.get(sid);

    const paidCourseIds = new Set(
      payment?.items
        .filter((i) => COURSE_PAID_TYPES.includes(i.itemType) && i.refId)
        .map((i) => i.refId!) || []
    );
    const paidExtraFeeTypeIds = new Set(
      payment?.items
        .filter((i) => EXTRA_FEE_PAID_TYPES.includes(i.itemType) && i.refId)
        .map((i) => i.refId!) || []
    );

    const unpaidCourses: UnpaidItem[] = [];
    for (const en of ens) {
      if (paidCourseIds.has(en.courseId)) continue;
      const fee = en.course.fees?.find((f) => f.gradeId === gradeId);
      const price = en.customPriceCents ?? fee?.amountCents ?? 0;
      unpaidCourses.push({
        type: 'COURSE',
        refId: en.courseId,
        name: en.course.name,
        code: en.course.code,
        price,
      });
    }

    const unpaidExtraFees: UnpaidItem[] = [];
    for (const ef of efs) {
      if (paidExtraFeeTypeIds.has(ef.extraFeeTypeId)) continue;
      unpaidExtraFees.push({
        type: 'EXTRA_FEE',
        refId: ef.extraFeeTypeId,
        name: ef.extraFeeType.name,
        code: ef.extraFeeType.code,
        price: ef.amountCents,
      });
    }

    const unpaidTotal =
      unpaidCourses.reduce((s, i) => s + i.price, 0) +
      unpaidExtraFees.reduce((s, i) => s + i.price, 0);

    result.set(sid, {
      unpaidCourses,
      unpaidExtraFees,
      unpaidTotal,
      hasAnyEnrollment: ens.length > 0 || efs.length > 0,
    });
  }

  return result;
}

/**
 * 判断账单是否已全额支付（基于应缴项目对比）
 * 替代直接看 paidAt 的简单判断
 */
export async function isPaymentFullyCovered(paymentId: string): Promise<boolean> {
  const payment = await prisma.studentTermPayment.findUnique({
    where: { id: paymentId },
    include: { term: true, items: true },
  });
  if (!payment) return false;

  const summary = await calculateUnpaidForStudent(
    payment.studentId,
    payment.term.id,
    (await prisma.student.findUnique({
      where: { id: payment.studentId },
      select: { gradeId: true },
    }))?.gradeId || 0
  );

  return summary.unpaidTotal === 0;
}
