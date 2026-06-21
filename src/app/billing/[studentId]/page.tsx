import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BillingForm } from "./BillingForm";
import { formatTermLabelFull, filterBillingCyclePayments } from "@/lib/term-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import {
  calculateUnpaidForStudent,
  resolveBillingTerm,
} from "@/lib/billing-utils";
import { COURSE_GROUP_COLORS, COURSE_GROUP_LABELS } from "@/lib/secondary-courses";

async function getData(studentId: string, year?: number, termIndex?: number) {
  const academicTerms = await getAcademicYearTerms();
  const currentTerm =
    year != null && termIndex != null
      ? academicTerms.find((t) => t.year === year && t.termIndex === termIndex) ??
        (await prisma.term.findFirst({ where: { year, termIndex } }))
      : null;

  const termId = currentTerm?.id;

  // 基础学生查询
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      grade: true,
      enrollments: { 
        include: { 
          course: {
            include: {
              fees: true
            }
          },
          startTerm: true,
          endTerm: true
        }
      },
      payments: { 
        orderBy: { createdAt: "desc" },
        include: {
          items: true
        }
      },
    },
  });

  if (!student) return null;

  // 筛选该学期有效的选课（用实际计费学期 termId，而非 feeTermId）
  // 若用 feeTermId(第4期) 过滤，第5期后新注册的学生 startTermId > 第4期 → 界面显示空选课
  const filteredEnrollments = termId
    ? student.enrollments.filter(
        (enrollment) =>
          enrollment.startTermId <= termId &&
          (!enrollment.endTermId || enrollment.endTermId >= termId)
      )
    : student.enrollments.filter((e) => !e.endTermId);

  // 收集所有 enrollment 的子科目 id 并查名字
  const allSubjectIds = Array.from(
    new Set(filteredEnrollments.flatMap((e) => e.subjectCourseIds || []))
  );
  const subjectCourses = allSubjectIds.length
    ? await prisma.course.findMany({
        where: { id: { in: allSubjectIds } },
        select: { id: true, name: true },
      })
    : [];
  const subjectNameMap = new Map(subjectCourses.map((c) => [c.id, c.name.replace(/^.*-/, "")]));

  // 尝试获取学生注册的额外费用（如果表存在）
  let studentExtraFees: Array<{
    id: number;
    extraFeeTypeId: number;
    amountCents: number;
    extraFeeType: { id: number; name: string; code: string };
    startTerm: { year: number; termIndex: number };
  }> = [];
  
  try {
    // 筛选在当前学期有效的额外费用
    const allExtraFees = await prisma.studentExtraFee.findMany({
      where: { studentId },
      include: {
        extraFeeType: true,
        startTerm: true
      }
    });
    
    studentExtraFees = termId
      ? allExtraFees.filter(
          (fee) =>
            fee.startTermId <= termId &&
            (!fee.endTermId || fee.endTermId >= termId)
        )
      : allExtraFees.filter((fee) => !fee.endTermId);
  } catch (e) {
    // 表可能还不存在，使用空数组
    console.log('StudentExtraFee表尚未创建或Prisma客户端未更新');
  }

  // 获取额外费用类型（用于显示未注册的额外费用选项）
  const extraFeeTypes = await prisma.extraFeeType.findMany({
    where: { isActive: true }
  }).catch(() => []);

  // 合并学生数据和筛选后的选课记录
  const studentWithFilteredData = {
    ...student,
    enrollments: filteredEnrollments,
    extraFees: studentExtraFees
  };

  return { student: studentWithFilteredData, currentTerm, extraFeeTypes, subjectNameMap };
}

export default async function BillingForStudentPage({ params, searchParams }: { 
  params: { studentId: string },
  searchParams?: { year?: string, term?: string }
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以进行费用结算</p>
          <Link 
            className="btn-modern bg-gradient-primary text-white px-6 py-3 inline-flex items-center space-x-2" 
            href="/login"
          >
            <span>🚀</span>
            <span>立即登录</span>
          </Link>
        </div>
      </div>
    );
  }

  const yearParam = searchParams?.year ? Number(searchParams.year) : undefined;
  const termParam = searchParams?.term ? Number(searchParams.term) : undefined;

  const resolvedTerm = await resolveBillingTerm(
    params.studentId,
    yearParam,
    termParam
  );
  if (!resolvedTerm) return notFound();

  const academicTerms = await getAcademicYearTerms();
  const termLabels = academicTerms.map((t) => ({
    year: t.year,
    termIndex: t.termIndex,
    period: t.period,
  }));

  const year = resolvedTerm.year;
  const termIndex = resolvedTerm.termIndex;

  const data = await getData(params.studentId, year, termIndex);
  if (!data) return notFound();
  
  const { student, currentTerm, extraFeeTypes, subjectNameMap } = data;
  const billingPayments = filterBillingCyclePayments(student.payments);

  const existingPayment = student.payments.find(
    (p) => p.year === year && p.termIndex === termIndex
  );
  const unpaidSummary = currentTerm
    ? await calculateUnpaidForStudent(student.id, currentTerm.id, student.gradeId)
    : null;
  const isFullyPaid = existingPayment && (unpaidSummary?.unpaidTotal ?? 0) === 0;
  const hasUnpaid = (unpaidSummary?.unpaidTotal ?? 0) > 0;
  const jumpedToUnpaid =
    !yearParam && !termParam && hasUnpaid;

  // 格式化金额
  const formatMoney = (cents: number) => {
    return `RM ${(cents / 100).toFixed(2)}`;
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const courseGroupNames = COURSE_GROUP_LABELS;
  const courseGroupColors = COURSE_GROUP_COLORS;

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* 页面标题 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">💰 费用结算</h1>
            <p className="text-gray-600">
              为 <span className="font-medium text-blue-600">{student.fullName}</span> 
              结算 {formatTermLabelFull(year, termIndex, termLabels)} 费用
            </p>
          </div>
          <Link 
            href={`/students/${student.id}`} 
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          >
            ← 返回学生详情
          </Link>
        </div>
      </div>

      {/* 学期信息 */}
      {currentTerm && (
        <div className="card-modern animate-fade-in">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  📅 {formatTermLabelFull(year, termIndex, termLabels)}
                </h2>
                <p className="text-sm text-gray-600">
                  {formatDate(currentTerm.startDate)} - {formatDate(currentTerm.endDate)}
                </p>
                {jumpedToUnpaid && (
                  <p className="text-xs text-amber-700 mt-1">
                    已自动跳转到该学生第一个待结算学期
                  </p>
                )}
              </div>
              <div className="text-sm text-gray-500">
                学期时长：{Math.ceil((currentTerm.endDate.getTime() - currentTerm.startDate.getTime()) / (1000 * 60 * 60 * 24))} 天
              </div>
            </div>
          </div>
        </div>
      )}

      {isFullyPaid && existingPayment ? (
        <div className="card-modern animate-fade-in p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {formatTermLabelFull(year, termIndex, termLabels)} 已缴清
          </h2>
          <p className="text-gray-600 mb-2">
            已收 RM {(existingPayment.totalCents / 100).toFixed(2)}
            {existingPayment.paidAt && (
              <span className="text-gray-500">
                {" "}· {new Date(existingPayment.paidAt).toLocaleDateString("zh-CN")} 缴费
              </span>
            )}
          </p>
          <p className="text-sm text-gray-500 mb-6">无需重复结算。若要修改金额或项目，请使用「修改账单」。</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/billing/receipt/${existingPayment.id}`}
              className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-6 py-3"
            >
              查看收据
            </Link>
            <Link
              href={`/billing/edit/${existingPayment.id}`}
              className="btn-modern bg-orange-100 text-orange-700 px-6 py-3 hover:bg-orange-200"
            >
              修改账单
            </Link>
            <Link
              href={`/students/${student.id}`}
              className="btn-modern bg-gray-100 text-gray-700 px-6 py-3 hover:bg-gray-200"
            >
              返回学生详情
            </Link>
          </div>
        </div>
      ) : existingPayment && hasUnpaid ? (
        <div className="card-modern animate-fade-in p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="font-medium text-amber-900">本期已有账单，尚有欠费</p>
            <p className="text-sm text-amber-800 mt-1">
              欠 RM {((unpaidSummary?.unpaidTotal ?? 0) / 100).toFixed(2)} · 请修改账单补录项目或调整金额
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/billing/edit/${existingPayment.id}`}
              className="btn-modern bg-green-600 hover:bg-green-700 text-white px-6 py-3"
            >
              💰 补结算 / 修改账单
            </Link>
            <Link
              href={`/billing/receipt/${existingPayment.id}`}
              className="btn-modern bg-blue-100 text-blue-700 px-6 py-3 hover:bg-blue-200"
            >
              查看当前账单
            </Link>
          </div>
        </div>
      ) : (
      /* 结算表单 */
      <div className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">
              ✅
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">费用明细</h2>
              <p className="text-gray-600 text-sm">选择需要缴费的项目</p>
            </div>
          </div>

          <BillingForm
            studentId={student.id}
            studentName={student.fullName}
            year={year}
            termIndex={termIndex}
            enrollments={student.enrollments.map(e => {
              const fee = e.course.fees?.find((f: any) => f.gradeId === student.gradeId);
              // 优先使用选课时设置的自定义价格 customPriceCents
              const defaultPrice = fee?.amountCents || 20000;
              const finalPrice = e.customPriceCents ?? defaultPrice;
              const subjects = (e.subjectCourseIds || [])
                .map((id: number) => subjectNameMap.get(id))
                .filter((n: any): n is string => !!n);
              return {
                id: e.id,
                price: finalPrice,
                hasCustomPrice: e.customPriceCents != null,
                defaultPrice,
                subjects,
                course: {
                  id: e.course.id,
                  name: e.course.name,
                  code: e.course.code,
                  group: e.course.group,
                }
              };
            })}
            extraFees={student.extraFees}
            extraFeeTypes={extraFeeTypes}
            gradeId={student.gradeId}
            termLabels={termLabels}
            courseGroupNames={courseGroupNames}
            courseGroupColors={courseGroupColors}
          />
        </div>
      </div>
      )}

      {/* 历史账单 */}
      {billingPayments.length > 0 && (
        <div className="card-modern animate-fade-in">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 历史账单</h3>
            <div className="space-y-3">
              {billingPayments.slice(0, 5).map(payment => (
                <div key={payment.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-800">
                      {formatTermLabelFull(payment.year, payment.termIndex, termLabels)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {payment.items.length} 个项目
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-gray-800">
                      {formatMoney(payment.totalCents)}
                    </div>
                    <div className={`text-sm ${payment.paidAt ? 'text-green-600' : 'text-red-600'}`}>
                      {payment.paidAt ? '已缴费' : '待缴费'}
                    </div>
                  </div>
                  <Link 
                    href={`/billing/receipt/${payment.id}`}
                    className="btn-modern bg-blue-100 text-blue-600 px-3 py-1 text-sm hover:bg-blue-200 transition-colors"
                  >
                    查看详情
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


