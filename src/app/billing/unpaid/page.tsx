import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calculateUnpaidForStudents, getCurrentOrLatestTerm } from "@/lib/billing-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { studentBillableInTermWhere } from "@/lib/student-billing-eligibility";
import { NotifyButton } from "./NotifyButton";
import {
  formatTermLabelFull,
  billingPeriodToTerm,
} from "@/lib/term-utils";

async function getData(period?: number, year?: number, termIndex?: number) {
  const allTerms = await getAcademicYearTerms();

  let termToUse;

  if (period) {
    const mapped = billingPeriodToTerm(period, allTerms);
    if (mapped) {
      termToUse = allTerms.find(
        (t) => t.year === mapped.year && t.termIndex === mapped.termIndex
      );
    }
  } else if (year && termIndex) {
    termToUse = allTerms.find((t) => t.year === year && t.termIndex === termIndex);
  } else {
    termToUse = await getCurrentOrLatestTerm();
  }

  if (!termToUse) {
    return { term: null, unpaidStudents: [], billingPeriods: [] as number[], allTerms };
  }

  const billingPeriods = allTerms.map((t) => t.period);

  // 该学期仍有应缴项目的在读学生（与停止补习规则统一）
  const studentsWithEnrollments = await prisma.student.findMany({
    where: studentBillableInTermWhere(termToUse.id, allTerms),
    include: {
      grade: true,
      guardians: { where: { isPrimary: true }, take: 1 },
    },
    orderBy: [{ grade: { orderIndex: 'asc' } }, { fullName: 'asc' }],
  });

  // 批量计算未支付情况
  const unpaidMap = await calculateUnpaidForStudents(
    studentsWithEnrollments.map((s) => s.id),
    termToUse.id
  );

  const unpaidStudents = studentsWithEnrollments
    .map((student) => {
      const summary = unpaidMap.get(student.id);
      if (!summary || summary.unpaidTotal <= 0) return null;

      const guardian = student.guardians[0];
      return {
        id: student.id,
        fullName: student.fullName,
        gradeName: student.grade?.name || '未分配年级',
        gradeOrder: student.grade?.orderIndex || 999,
        unpaidCourses: summary.unpaidCourses.map((c) => ({ name: c.name, price: c.price })),
        unpaidExtraFees: summary.unpaidExtraFees.map((f) => ({ name: f.name, price: f.price })),
        unpaidTotal: summary.unpaidTotal,
        guardianPhone: guardian?.phone,
        guardianName: guardian?.name,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return { term: termToUse, unpaidStudents, billingPeriods, allTerms };
}

function formatMoney(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

export default async function UnpaidStudentsPage({
  searchParams,
}: {
  searchParams?: { year?: string; term?: string; period?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">需要登录</h2>
          <Link className="text-blue-600 hover:underline" href="/login">立即登录</Link>
        </div>
      </div>
    );
  }

  const year = searchParams?.year ? Number(searchParams.year) : undefined;
  const termIndex = searchParams?.term ? Number(searchParams.term) : undefined;
  const periodParam = searchParams?.period ? Number(searchParams.period) : undefined;

  const { term, unpaidStudents, billingPeriods, allTerms } = await getData(periodParam, year, termIndex);

  const user = await prisma.user.findUnique({
    where: { username: session.user?.name || "" },
    include: { roles: { include: { role: true } } },
  });
  const userRoles = user?.roles.map((r) => r.role.code as string) || [];
  const canSettle = userRoles.includes("RECIPIENT") || userRoles.includes("ADMIN");

  const currentPeriod = term ? term.period : null;

  type UnpaidStudent = typeof unpaidStudents[number];
  const studentsByGrade = unpaidStudents.reduce<Record<string, { gradeOrder: number; students: UnpaidStudent[] }>>((acc, student) => {
    if (!acc[student.gradeName]) {
      acc[student.gradeName] = { gradeOrder: student.gradeOrder, students: [] };
    }
    acc[student.gradeName].students.push(student);
    return acc;
  }, {});

  const sortedGrades = Object.entries(studentsByGrade).sort(
    (a, b) => a[1].gradeOrder - b[1].gradeOrder
  );

  const totalUnpaid = unpaidStudents.reduce((sum, s) => sum + s.unpaidTotal, 0);

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">💰</span>
            待支付学生列表
          </h1>
          <p className="text-gray-600 mt-1">
            {term
              ? `${formatTermLabelFull(term.year, term.termIndex, allTerms)} - 共 ${unpaidStudents.length} 名学生未完成缴费`
              : '未设置学期'}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
        >
          ← 返回工作台
        </Link>
      </div>

      <div className="card-modern p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-600">选择学期：</label>
            <form className="flex items-center gap-2">
              <select
                name="period"
                defaultValue={currentPeriod || ""}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                {billingPeriods.map((p) => (
                  <option key={p} value={p}>
                    第{p}期
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
              >
                查询
              </button>
            </form>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{unpaidStudents.length}</div>
              <div className="text-xs text-gray-500">待支付学生</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{formatMoney(totalUnpaid)}</div>
              <div className="text-xs text-gray-500">未支付总额</div>
            </div>
          </div>
        </div>
      </div>

      {unpaidStudents.length > 0 && (
        <div className="card-modern p-4 bg-gradient-to-r from-amber-50 to-orange-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📢</span>
              <div>
                <h3 className="font-semibold text-gray-800">批量通知</h3>
                <p className="text-sm text-gray-600">
                  向所有待支付学生的监护人发送缴费提醒
                </p>
              </div>
            </div>
            <NotifyButton
              studentIds={unpaidStudents.map((s) => s.id)}
              year={term?.year || 0}
              termIndex={term?.termIndex || 0}
            />
          </div>
        </div>
      )}

      {term ? (
        unpaidStudents.length > 0 ? (
          <div className="space-y-6">
            {sortedGrades.map(([gradeName, { students }]) => (
              <div key={gradeName} className="card-modern overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <span>📚</span>
                    {gradeName}
                    <span className="text-sm font-normal text-gray-500">
                      ({students.length} 名学生)
                    </span>
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {students.map((student) => (
                    <div
                      key={student.id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <Link
                          href={`/students/${student.id}`}
                          className="flex items-center gap-4 flex-1 min-w-0 group"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold shrink-0">
                            {student.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">
                              {student.fullName}
                            </div>
                            <div className="text-sm text-gray-500 flex flex-wrap gap-2 mt-1">
                              {student.unpaidCourses.map((c, i) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                                  📚 {c.name}
                                </span>
                              ))}
                              {student.unpaidExtraFees.map((f, i) => (
                                <span key={i} className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                                  🍽️ {f.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </Link>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="font-bold text-red-600 text-lg">
                              {formatMoney(student.unpaidTotal)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {student.guardianPhone ? `📱 ${student.guardianPhone}` : "无联系方式"}
                            </div>
                          </div>
                          {canSettle && term && (
                            <Link
                              href={`/billing/${student.id}?year=${term.year}&term=${term.termIndex}`}
                              className="btn-modern bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium whitespace-nowrap"
                            >
                              💰 结算
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-modern p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">太棒了！</h3>
            <p className="text-gray-600">
              {formatTermLabelFull(term.year, term.termIndex, allTerms)}所有学生都已完成缴费
            </p>
          </div>
        )
      ) : (
        <div className="card-modern p-12 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">未找到学期</h3>
          <p className="text-gray-600">请先在管理后台设置学期信息</p>
          <Link
            href="/admin/terms"
            className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            设置学期
          </Link>
        </div>
      )}
    </div>
  );
}
