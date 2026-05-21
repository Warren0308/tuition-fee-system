import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GuardianManager } from "./GuardianManager";
import { SubjectTagsEditor } from "./SubjectTagsEditor";
import { StopTutoringPanel } from "./StopTutoringPanel";
import { ForceCloseTermButton } from "./ForceCloseTermButton";
import { calculateUnpaidForStudent } from "@/lib/billing-utils";
import { getAcademicYearTerms, ACADEMIC_YEAR_LABEL } from "@/lib/academic-year";
import { getTutoringStatus } from "@/lib/student-billing-eligibility";
import { getForceClosedTermKeys, termCoordKey } from "@/lib/term-force-close";
import {
  formatTermLabel,
  filterBillingCyclePayments,
} from "@/lib/term-utils";

// 主课程 + 其细分子科目的映射 (按 code)
// 补习班：小学细分 + 中学国文/英文
const SUBJECT_TAG_CONFIG: Record<string, string[]> = {
  TUITION_CLASS: [
    "TUITION_CN", "TUITION_BM", "TUITION_EN", "TUITION_MATH", "TUITION_SCI",
    "SEC_BM", "SEC_EN",
  ],
};

async function getData(id: string) {
  const [student, terms, guardianTypes, allTagCourses] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        grade: true,
        school: true,
        guardians: {
          include: { relationType: true },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        enrollments: {
          include: {
            course: true,
            startTerm: true,
            endTerm: true,
          },
          orderBy: { startTermId: "asc" },
        },
        extraFees: {
          include: {
            extraFeeType: true,
            startTerm: true,
            endTerm: true,
          },
          orderBy: { startTermId: "asc" },
        },
        payments: {
          include: { items: true },
          orderBy: { year: "desc" },
        },
      },
    }),
    getAcademicYearTerms(),
    prisma.guardianType.findMany({ orderBy: { name: "asc" } }),
    // 获取所有可能的子科目课程
    prisma.course.findMany({
      where: {
        code: { in: Object.values(SUBJECT_TAG_CONFIG).flat() },
      },
      select: { id: true, name: true, code: true },
    }),
  ]);

  if (!student) return null;

  const forceCloseKeys = await getForceClosedTermKeys(student.id);

  // 计算每个学期的待支付状态
  const termUnpaidMap = new Map<number, number>();
  for (const term of terms) {
    const summary = await calculateUnpaidForStudent(student.id, term.id, student.gradeId);
    termUnpaidMap.set(term.id, summary.unpaidTotal);
  }

  return { student, terms, guardianTypes, termUnpaidMap, allTagCourses, forceCloseKeys };
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以查看学生详情</p>
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

  const data = await getData(params.id);
  if (!data) return notFound();

  // 获取用户角色
  const user = await prisma.user.findUnique({
    where: { username: session.user?.name || '' },
    include: { roles: { include: { role: true } } }
  });
  
  const userRoles = user?.roles.map(r => r.role.code as string) || [];
  const isCashier = userRoles.includes('RECIPIENT'); // 实际角色代号为 RECIPIENT
  const isAdmin = userRoles.includes('ADMIN');
  
  const { student, terms, guardianTypes, termUnpaidMap, allTagCourses, forceCloseKeys } = data;
  const canManageBilling = isCashier || isAdmin;

  const tutoringStatus = getTutoringStatus(
    student.enrollments,
    student.extraFees,
    terms
  );
  const termOptions = terms.map((t) => ({
    id: t.id,
    period: t.period,
    label: formatTermLabel(t.year, t.termIndex, terms),
  }));
  const panelStatus =
    tutoringStatus.kind === "active"
      ? ("active" as const)
      : tutoringStatus.kind === "stopped"
        ? ("stopped" as const)
        : ("none" as const);

  // 找出可以管理细分科目的选课 (目前只有 补习班)
  const enrollmentsWithSubjects = student.enrollments
    .filter((e) => !e.endTermId && SUBJECT_TAG_CONFIG[e.course.code])
    .map((e) => {
      const subjectCodes = SUBJECT_TAG_CONFIG[e.course.code] || [];
      const availableSubjects = allTagCourses
        .filter((c) => subjectCodes.includes(c.code))
        .map((c) => ({
          id: c.id,
          name: c.name,
          shortName: c.name.replace(/^.*-/, ""),
        }));
      return {
        enrollment: e,
        availableSubjects,
      };
    });

  // 2026 学年 13 期（与学期管理同一数据源）
  const billingCycleGroups = [{ label: ACADEMIC_YEAR_LABEL, terms }];
  const billingPayments = filterBillingCyclePayments(student.payments);

  // 获取学生在特定学期的选课情况
  const getEnrollmentsForTerm = (termId: number) => {
    // 筛选出在指定学期有效的所有选课记录
    const validEnrollments = student.enrollments.filter(enrollment => 
      enrollment.startTermId <= termId && 
      (!enrollment.endTermId || enrollment.endTermId >= termId)
    );
    
    // 按课程ID去重，每门课程只保留在该学期最相关的记录
    // （如果同一门课程有多条有效记录，保留startTermId最接近当前学期的）
    const uniqueEnrollments = validEnrollments.reduce((acc, enrollment) => {
      const courseId = enrollment.course.id;
      const existing = acc[courseId];
      if (!existing) {
        acc[courseId] = enrollment;
      } else {
        // 如果当前记录的startTermId更接近查询的termId，使用当前记录
        const existingDiff = Math.abs(existing.startTermId - termId);
        const currentDiff = Math.abs(enrollment.startTermId - termId);
        if (currentDiff < existingDiff) {
          acc[courseId] = enrollment;
        }
      }
      return acc;
    }, {} as Record<number, typeof student.enrollments[0]>);
    
    return Object.values(uniqueEnrollments);
  };

  const getExtraFeesForTerm = (termId: number) => {
    return student.extraFees.filter(
      (ef) =>
        ef.startTermId <= termId &&
        (!ef.endTermId || ef.endTermId >= termId)
    );
  };

  // 获取学生在特定学期的费用情况
  const getPaymentForTerm = (year: number, termIndex: number) => {
    return student.payments.find(payment => 
      payment.year === year && payment.termIndex === termIndex
    );
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* 页面标题 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              👤 {student.fullName}
              {!student.isActive && (
                <span className="text-sm font-normal px-2 py-1 bg-red-100 text-red-700 rounded-full">
                  档案已停用
                </span>
              )}
              {tutoringStatus.kind === "stopped" && student.isActive && (
                <span className="text-sm font-normal px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                  已停止补习{tutoringStatus.lastPeriod != null ? `（最后第${tutoringStatus.lastPeriod}期）` : ""}
                </span>
              )}
            </h1>
            <p className="text-gray-600">学生详细资料与学期记录</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/students/${student.id}/edit`}
              className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 inline-flex items-center gap-2"
            >
              <span>✏️</span>
              <span>编辑资料</span>
            </Link>
            <Link
              href={`/students/${student.id}/changelog`}
              className="btn-modern bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 inline-flex items-center gap-2"
            >
              <span>📜</span>
              <span>修改历史</span>
            </Link>
            {isAdmin && (
              <form
                action={`/api/students/${student.id}`}
                method="post"
                className="inline"
              >
                <input
                  type="hidden"
                  name="_method"
                  value={student.isActive ? "DELETE" : "RESTORE"}
                />
                <button
                  type="submit"
                  className={`btn-modern px-4 py-2 inline-flex items-center gap-2 ${
                    student.isActive
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  }`}
                >
                  <span>{student.isActive ? "⏸" : "▶️"}</span>
                  <span>{student.isActive ? "停用档案" : "启用档案"}</span>
                </button>
              </form>
            )}
            <Link
              href="/students"
              className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
            >
              ← 返回列表
            </Link>
          </div>
        </div>
      </div>

      {student.isActive && (panelStatus === "active" || panelStatus === "stopped") && (
        <StopTutoringPanel
          studentId={student.id}
          studentName={student.fullName}
          terms={termOptions}
          status={panelStatus}
          lastPeriod={tutoringStatus.kind === "stopped" ? tutoringStatus.lastPeriod : null}
        />
      )}

      {/* 基本信息卡片 */}
      <div className="grid lg:grid-cols-3 gap-6 animate-fade-in">
        {/* 学生基本信息 */}
        <div className="card-modern">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
                {student.fullName.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{student.fullName}</h2>
                <p className="text-gray-600">学生基本信息</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">年级：</span>
                <span className="font-medium text-blue-600">{student.grade?.name || '未分配'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">班级：</span>
                <span className="font-medium text-gray-800">{student.className || '未分配'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">学校：</span>
                <span className="font-medium text-gray-800">{student.school?.name || '未填写'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">状态：</span>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  !student.isActive
                    ? 'bg-red-100 text-red-800'
                    : tutoringStatus.kind === 'stopped'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {!student.isActive
                    ? '档案已停用'
                    : tutoringStatus.kind === 'stopped'
                      ? `已停止补习${tutoringStatus.lastPeriod != null ? `（第${tutoringStatus.lastPeriod}期）` : ''}`
                      : '在读'}
                </span>
              </div>
            </div>

            {student.address && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">地址</p>
                <p className="font-medium text-gray-800">{student.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* 监护人信息 */}
        <div className="card-modern">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
                👨‍👩‍👧‍👦
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">监护人信息</h2>
                <p className="text-gray-600 text-sm">联系人与关系</p>
              </div>
            </div>
            
            <GuardianManager
              studentId={student.id}
              guardians={student.guardians.map((g) => ({
                id: g.id,
                name: g.name,
                phone: g.phone,
                isPrimary: g.isPrimary,
                relationTypeId: g.relationTypeId,
                relationType: g.relationType,
              }))}
              guardianTypes={guardianTypes}
            />
          </div>
        </div>

        {/* 快速统计 */}
        <div className="card-modern">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">
                📊
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">学习统计</h2>
                <p className="text-gray-600 text-sm">课程与费用概览</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">在读课程</span>
                <span className="text-2xl font-bold text-blue-600">
                  {student.enrollments.filter(e => !e.endTermId).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">历史课程</span>
                <span className="text-2xl font-bold text-gray-600">
                  {student.enrollments.length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">待缴费用</span>
                <span className="text-lg font-bold text-red-600">
                  {student.payments.filter(p => !p.paidAt).length > 0 ? (
                    `RM ${(student.payments.filter(p => !p.paidAt)[0]?.totalCents / 100).toFixed(2)}`
                  ) : (
                    '无'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 课程细分（如补习班的子科目） */}
      {enrollmentsWithSubjects.length > 0 && (
        <div className="card-modern animate-fade-in">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
                📑
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">课程细分</h2>
                <p className="text-gray-600 text-sm">
                  补习班下细分了哪些科目（不影响价格，仅作记录）
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {enrollmentsWithSubjects.map(({ enrollment, availableSubjects }) => (
                <div key={enrollment.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-gray-800">
                      📚 {enrollment.course.name}
                      {enrollment.customPriceCents != null && (
                        <span className="ml-2 text-sm text-gray-500">
                          RM {(enrollment.customPriceCents / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                  <SubjectTagsEditor
                    enrollmentId={enrollment.id}
                    courseName={enrollment.course.name}
                    availableSubjects={availableSubjects}
                    initialSubjectIds={enrollment.subjectCourseIds || []}
                    canEdit={isAdmin || isCashier}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 学期记录表格 */}
      <div className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">📅 学期记录</h2>
              <p className="text-gray-600 text-sm">查看各学期的选课和费用情况</p>
            </div>
            <div className="flex space-x-2">
              <Link 
                href={`/students/${student.id}/enroll`}
                className="btn-modern bg-green-600 hover:bg-green-700 text-white px-4 py-2 inline-flex items-center space-x-2"
              >
                <span>📚</span>
                <span>选课管理</span>
              </Link>
              <a 
                href={`#billing-history`}
                className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 inline-flex items-center space-x-2"
              >
                <span>📋</span>
                <span>账单查看</span>
              </a>
            </div>
          </div>

          {billingCycleGroups.length > 0 ? (
            <div className="space-y-8">
              {billingCycleGroups.map(({ label, terms: groupTerms }) => (
                <div key={label} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
                    <p className="text-xs text-gray-500 mt-1">共 13 期 · 浅红行 = 待结算 · 💰 结算 / ✓ 强制结清（本期不再追收）</p>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">学期</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">日期范围</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">选课情况</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">费用状态</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {groupTerms.map(term => {
                            const enrollments = getEnrollmentsForTerm(term.id);
                            const extraFees = getExtraFeesForTerm(term.id);
                            const hasBillableItems = enrollments.length > 0 || extraFees.length > 0;
                            const payment = getPaymentForTerm(term.year, term.termIndex);
                            const forceClosed = forceCloseKeys.has(
                              termCoordKey(term.year, term.termIndex)
                            );
                            const unpaidCents = termUnpaidMap.get(term.id) ?? 0;
                            const needsSettle = unpaidCents > 0 && !forceClosed;
                            
                            return (
                              <tr key={term.id} className={`hover:bg-gray-50 ${needsSettle ? "bg-red-50/60" : ""}`}>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full w-fit">
                                      {formatTermLabel(term.year, term.termIndex, terms)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {formatDate(term.startDate)} - {formatDate(term.endDate)}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    {enrollments.length > 0 || extraFees.length > 0 ? (
                                      <div className="flex flex-wrap gap-1 max-w-xs">
                                        {enrollments.map(enrollment => {
                                          // 课程名称缩写映射
                                          const shortName = enrollment.course.name
                                            .replace('补习班-', '')
                                            .replace('小学-', '')
                                            .replace('中学-', '中')
                                            .replace('国文', '国')
                                            .replace('英文', '英')
                                            .replace('华文', '华')
                                            .replace('数学', '数')
                                            .replace('科学', '科')
                                            .replace('功课班', '功课')
                                            .replace('写作班', '写作');
                                          
                                          return (
                                            <span 
                                              key={enrollment.id}
                                              className="inline-flex px-1.5 py-0.5 text-[10px] bg-green-100 text-green-800 rounded"
                                              title={enrollment.course.name}
                                            >
                                              {shortName}
                                            </span>
                                          );
                                        })}
                                        {extraFees.map(ef => (
                                          <span
                                            key={ef.id}
                                            className="inline-flex px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-800 rounded"
                                            title={ef.extraFeeType.name}
                                          >
                                            {ef.extraFeeType.name}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">-</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  {(() => {
                                    const unpaidCents = termUnpaidMap.get(term.id) ?? 0;
                                    const hasUnpaid = unpaidCents > 0 && !forceClosed;
                                    if (forceClosed) {
                                      return (
                                        <div className="space-y-1">
                                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                                            已确认结清
                                          </span>
                                          {payment && (
                                            <div className="text-xs text-gray-600">
                                              已收: RM {(payment.totalCents / 100).toFixed(2)}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    if (payment) {
                                      return (
                                        <div className="space-y-1">
                                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                            !hasUnpaid
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}>
                                            {!hasUnpaid ? '全部缴清' : '部分缴清'}
                                          </span>
                                          <div className="text-xs text-gray-600">
                                            已收: RM {(payment.totalCents / 100).toFixed(2)}
                                          </div>
                                          {hasUnpaid && (
                                            <div className="text-xs text-red-600">
                                              欠: RM {(unpaidCents / 100).toFixed(2)}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    if (hasBillableItems) {
                                      return (
                                        <div className="space-y-1">
                                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                            未结算
                                          </span>
                                          {hasUnpaid && (
                                            <div className="text-xs text-red-600">
                                              应缴: RM {(unpaidCents / 100).toFixed(2)}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    return <span className="text-sm text-gray-500">无费用记录</span>;
                                  })()}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {(() => {
                                    const showOps = payment || needsSettle || forceClosed || hasBillableItems;
                                    if (!showOps) {
                                      return <span className="text-xs text-gray-400">无</span>;
                                    }

                                    return (
                                      <div className="flex flex-wrap justify-center gap-1">
                                        {payment && (
                                          <Link
                                            href={`/billing/receipt/${payment.id}`}
                                            className="btn-modern bg-blue-100 text-blue-600 px-3 py-1 text-xs hover:bg-blue-200 transition-colors"
                                          >
                                            查看
                                          </Link>
                                        )}
                                        {(isCashier || isAdmin) && payment && (
                                          <Link
                                            href={`/billing/edit/${payment.id}`}
                                            className="btn-modern bg-orange-100 text-orange-600 px-3 py-1 text-xs hover:bg-orange-200 transition-colors"
                                          >
                                            修改
                                          </Link>
                                        )}
                                        {needsSettle && (
                                          <Link
                                            href={`/billing/${student.id}?year=${term.year}&term=${term.termIndex}`}
                                            className="btn-modern bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs font-medium transition-colors"
                                          >
                                            💰 {payment ? "补结算" : "结算"}
                                          </Link>
                                        )}
                                        {(needsSettle || forceClosed) && (
                                          <ForceCloseTermButton
                                            studentId={student.id}
                                            year={term.year}
                                            termIndex={term.termIndex}
                                            termLabel={formatTermLabel(term.year, term.termIndex, terms)}
                                            paidCents={payment?.totalCents}
                                            forceClosed={forceClosed}
                                            canManage={canManageBilling}
                                          />
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">暂无学期记录</h3>
              <p className="text-gray-600">请先配置学期信息</p>
            </div>
          )}
        </div>
      </div>

      {/* 账单历史 */}
      <div id="billing-history" className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">账单历史</h2>
              <p className="text-gray-600 text-sm">查看所有历史账单和缴费记录</p>
            </div>
          </div>

          {billingPayments.length > 0 ? (
            <div className="space-y-4">
              {billingPayments.map(payment => (
                <div key={payment.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="inline-flex px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full">
                        {formatTermLabel(payment.year, payment.termIndex, terms)}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        payment.paidAt 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {payment.paidAt ? '已缴费' : '待缴费'}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-800">
                        RM {(payment.totalCents / 100).toFixed(2)}
                      </div>
                      {payment.paidAt && (
                        <div className="text-xs text-gray-500">
                          缴费时间：{new Date(payment.paidAt).toLocaleDateString('zh-CN')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {payment.items?.length || 0} 个收费项目
                      {payment.note && (
                        <span className="ml-2 text-gray-500">• {payment.note}</span>
                      )}
                    </div>
                    <div className="flex space-x-2">
                      <Link 
                        href={`/billing/receipt/${payment.id}`}
                        className="btn-modern bg-blue-100 text-blue-600 px-3 py-1 text-xs hover:bg-blue-200 transition-colors"
                      >
                        查看详情
                      </Link>
                      {!payment.paidAt && (isCashier || isAdmin) && (
                        <>
                          <Link 
                            href={`/billing/${student.id}?year=${payment.year}&term=${payment.termIndex}`}
                            className="btn-modern bg-green-100 text-green-600 px-3 py-1 text-xs hover:bg-green-200 transition-colors"
                          >
                            💰 结算
                          </Link>
                          <Link 
                            href={`/billing/edit/${payment.id}`}
                            className="btn-modern bg-orange-100 text-orange-600 px-3 py-1 text-xs hover:bg-orange-200 transition-colors"
                          >
                            编辑账单
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">暂无账单记录</h3>
              <p className="text-gray-600">该学生还没有任何费用账单</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


