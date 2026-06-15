import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { EnrollmentForm } from "./EnrollmentForm";
import { AddExtraFeeSegment } from "./AddExtraFeeSegment";
import { StopTutoringPanel } from "../StopTutoringPanel";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { getTutoringStatus } from "@/lib/student-billing-eligibility";
import {
  formatTermLabel,
} from "@/lib/term-utils";
import { COURSE_GROUP_COLORS, COURSE_GROUP_LABELS } from "@/lib/secondary-courses";

async function getData(studentId: string) {
  const student = await prisma.student.findUnique({ 
    where: { id: studentId }, 
    include: { 
      grade: true,
      enrollments: { 
        include: { 
          course: true, 
          startTerm: true, 
          endTerm: true 
        },
        orderBy: { startTermId: "desc" }
      } 
    } 
  });
  
  if (!student) return null;

  // 只获取该学生年级有费用设置的课程
  const [courses, terms, extraFeeTypes] = await Promise.all([
    // 通过 CourseFee 表查询有该年级费用设置的课程
    prisma.course.findMany({ 
      where: { 
        isActive: true,
        // 只查询有该年级费用设置的课程
        fees: {
          some: {
            gradeId: student.gradeId
          }
        }
      }, 
      include: {
        fees: {
          where: { gradeId: student.gradeId },
          orderBy: { effectiveFrom: 'desc' },
          take: 1
        }
      },
      orderBy: { name: "asc" }
    }),
    getAcademicYearTerms(),
    // 只获取该年级有费用设置的额外费用类型
    prisma.extraFeeType.findMany({
      where: { 
        isActive: true,
        rates: {
          some: {
            gradeId: student.gradeId
          }
        }
      },
      include: {
        rates: {
          where: { gradeId: student.gradeId },
          orderBy: { effectiveFrom: 'desc' },
          take: 1
        }
      }
    })
  ]);

  // 获取学生已注册的额外费用
  let studentExtraFees: Array<{
    id: number;
    extraFeeTypeId: number;
    amountCents: number;
    startTermId: number;
    endTermId: number | null;
    extraFeeType: { id: number; name: string; code: string };
    startTerm: { id: number; year: number; termIndex: number; startDate: Date };
    endTerm: { id: number; year: number; termIndex: number; endDate: Date } | null;
  }> = [];
  
  try {
    studentExtraFees = await prisma.studentExtraFee.findMany({
      where: { studentId },
      include: {
        extraFeeType: true,
        startTerm: true,
        endTerm: true
      },
      orderBy: { startTermId: "desc" }
    });
  } catch (e) {
    console.log('获取额外费用记录失败');
  }

  return { student, courses, terms, extraFeeTypes, studentExtraFees };
}

export default async function EnrollManagePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以管理学生选课</p>
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
  if (!data || !data.student) return notFound();
  
  const { student, courses, terms, extraFeeTypes, studentExtraFees } = data;

  const tutoringStatus = getTutoringStatus(
    student.enrollments,
    studentExtraFees,
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
  const enrollRedirect = `/students/${student.id}/enroll`;

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // 获取学生已选择的课程ID
  const enrolledCourseIds = student.enrollments
    .filter(e => !e.endTermId)
    .map(e => e.courseId);

  // 按课程组分组，并转换为可序列化格式
  const coursesByGroup = courses.reduce((acc, course) => {
    if (!acc[course.group]) {
      acc[course.group] = [];
    }
    const defaultPrice = course.fees[0]?.amountCents || 5000;
    acc[course.group].push({
      id: course.id,
      code: course.code,
      name: course.name,
      group: course.group,
      defaultPrice
    });
    return acc;
  }, {} as Record<string, Array<{id: number; code: string; name: string; group: string; defaultPrice: number}>>);

  // 转换额外费用为可序列化格式
  const extraFees = extraFeeTypes.map(type => ({
    id: type.id,
    code: type.code,
    name: type.name,
    defaultPrice: type.rates[0]?.amountCents || 0
  }));

  // 转换学期为可序列化格式
  const termsData = terms.map((term) => ({
    id: term.id,
    year: term.year,
    termIndex: term.termIndex,
    period: term.period,
    startDate: term.startDate.toISOString(),
    endDate: term.endDate.toISOString()
  }));

  const courseGroupNames = COURSE_GROUP_LABELS;
  const courseGroupColors = COURSE_GROUP_COLORS;

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* 页面标题 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📚 选课管理</h1>
            <p className="text-gray-600">
              为 <span className="font-medium text-blue-600">{student.fullName}</span> 
              ({student.grade?.name}) 安排课程
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

      {student.isActive && (panelStatus === "active" || panelStatus === "stopped") && (
        <StopTutoringPanel
          studentId={student.id}
          studentName={student.fullName}
          terms={termOptions}
          status={panelStatus}
          lastPeriod={tutoringStatus.kind === "stopped" ? tutoringStatus.lastPeriod : null}
          redirect={enrollRedirect}
        />
      )}

      {/* 新增选课 - 使用客户端组件 */}
      <EnrollmentForm
        studentId={student.id}
        coursesByGroup={coursesByGroup}
        enrolledCourseIds={enrolledCourseIds}
        terms={termsData}
        extraFees={extraFees}
        courseGroupNames={courseGroupNames}
        courseGroupColors={courseGroupColors}
      />

      {/* 当前选课列表 */}
      <div className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">选课记录</h2>
              <p className="text-gray-600 text-sm">当前和历史选课情况 · 停止全部课程请用上方「停止补习」</p>
            </div>
            <div className="text-sm text-gray-500">
              共 {student.enrollments.length} 条记录
            </div>
          </div>

          {student.enrollments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">课程信息</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">价格</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">开始学期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">结束学期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">状态</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {student.enrollments.map((enrollment, index) => {
                    // 获取默认价格
                    const courseFee = courses.find(c => c.id === enrollment.courseId);
                    const defaultPrice = courseFee?.fees?.[0]?.amountCents || 0;
                    const currentPrice = (enrollment as any).customPriceCents ?? defaultPrice;
                    
                    return (
                    <tr key={enrollment.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex px-2 py-1 text-xs border rounded-full ${
                            courseGroupColors[enrollment.course.group as keyof typeof courseGroupColors]
                          }`}>
                            {courseGroupNames[enrollment.course.group as keyof typeof courseGroupNames]}
                          </span>
                          <div>
                            <div className="font-medium text-gray-800">{enrollment.course.name}</div>
                            <div className="text-xs text-gray-500">{enrollment.course.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!enrollment.endTerm ? (
                          <form 
                            action={`/api/enrollments/enrollment/${enrollment.id}/update-price`} 
                            method="post"
                            className="flex items-center space-x-2"
                          >
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">RM</span>
                              <input 
                                type="number"
                                step="0.01"
                                name="price"
                                defaultValue={(currentPrice / 100).toFixed(2)}
                                className="input-modern text-xs pl-8 pr-2 py-1 w-24 text-center"
                              />
                            </div>
                            <button 
                              type="submit"
                              className="btn-modern bg-green-100 text-green-600 px-2 py-1 text-xs hover:bg-green-200 transition-colors"
                              title="更新价格"
                            >
                              ✓
                            </button>
                            {(enrollment as any).customPriceCents && (
                              <span className="text-xs text-orange-500" title={`默认价格: RM ${(defaultPrice / 100).toFixed(2)}`}>
                                *
                              </span>
                            )}
                          </form>
                        ) : (
                          <span className="font-medium text-gray-600">
                            RM {(currentPrice / 100).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {!enrollment.endTerm ? (
                          <form 
                            action={`/api/enrollments/enrollment/${enrollment.id}/update-start`} 
                            method="post"
                            className="flex items-center space-x-2"
                          >
                            <select 
                              name="startTermId" 
                              defaultValue={enrollment.startTermId}
                              className="input-modern text-xs px-2 py-1 w-32"
                            >
                              {terms.map(t => (
                                <option key={t.id} value={t.id}>
                                  {formatTermLabel(t.year, t.termIndex, terms)}
                                </option>
                              ))}
                            </select>
                            <button 
                              type="submit"
                              className="btn-modern bg-blue-100 text-blue-600 px-2 py-1 text-xs hover:bg-blue-200 transition-colors"
                              title="更新开始学期"
                            >
                              ✓
                            </button>
                          </form>
                        ) : enrollment.startTerm ? (
                          <div>
                            <div className="font-medium">{formatTermLabel(enrollment.startTerm.year, enrollment.startTerm.termIndex, terms)}</div>
                            <div className="text-xs text-gray-500">
                              {formatDate(enrollment.startTerm.startDate)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">未设置</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {enrollment.endTerm ? (
                          <div>
                            <div className="font-medium">{formatTermLabel(enrollment.endTerm.year, enrollment.endTerm.termIndex, terms)}</div>
                            <div className="text-xs text-gray-500">
                              {formatDate(enrollment.endTerm.endDate)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-green-600 font-medium">进行中</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          enrollment.endTerm 
                            ? 'bg-gray-100 text-gray-700' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {enrollment.endTerm ? '已结束' : '在读'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!enrollment.endTerm && (
                          <form action={`/api/enrollments/enrollment/${enrollment.id}/end`} method="post" className="inline-flex items-center space-x-2">
                            <select name="endTermId" className="input-modern text-xs px-2 py-1">
                              {terms
                                .filter(t => 
                                  !enrollment.startTerm || 
                                  (t.year > enrollment.startTerm.year || 
                                   (t.year === enrollment.startTerm.year && t.termIndex >= enrollment.startTerm.termIndex))
                                )
                                .map(t => (
                                  <option key={t.id} value={t.id}>
                                    {formatTermLabel(t.year, t.termIndex, terms)}
                                  </option>
                                ))}
                            </select>
                            <button className="btn-modern bg-red-100 text-red-600 px-3 py-1 text-xs hover:bg-red-200 transition-colors">
                              结束课程
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">暂无选课记录</h3>
              <p className="text-gray-600">请为学生添加第一门课程</p>
            </div>
          )}
        </div>
      </div>

      {/* 额外费用记录 */}
      <div className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">🍽️ 额外费用记录</h2>
              <p className="text-gray-600 text-sm">
                膳食、交通等 — 某一期不收请用「分段」分开登记（勿一条记录横跨多期）
              </p>
            </div>
            <div className="text-sm text-gray-500">
              共 {studentExtraFees.length} 条记录
            </div>
          </div>

          {studentExtraFees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">费用类型</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">金额</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">开始学期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">结束学期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">状态</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {studentExtraFees.map((extraFee, index) => {
                    const startIdx = terms.findIndex((t) => t.id === extraFee.startTermId);
                    const endIdx = extraFee.endTermId
                      ? terms.findIndex((t) => t.id === extraFee.endTermId)
                      : terms.length - 1;
                    const periodLabel =
                      startIdx >= 0 && endIdx >= startIdx
                        ? endIdx === startIdx
                          ? `仅第${terms[startIdx].period}期`
                          : `第${terms[startIdx].period}–${terms[endIdx].period}期`
                        : null;

                    return (
                    <tr key={extraFee.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-orange-50 transition-colors`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <span className="inline-flex px-2 py-1 text-xs border rounded-full bg-orange-100 text-orange-800 border-orange-200">
                            额外费用
                          </span>
                          <div>
                            <div className="font-medium text-gray-800">{extraFee.extraFeeType.name}</div>
                            <div className="text-xs text-gray-500">
                              {extraFee.extraFeeType.code}
                              {periodLabel && (
                                <span className="ml-2 text-orange-600">· {periodLabel}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!extraFee.endTerm ? (
                          <form 
                            action={`/api/extra-fees/${extraFee.id}/update-price`} 
                            method="post"
                            className="flex items-center space-x-2"
                          >
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">RM</span>
                              <input 
                                type="number"
                                step="0.01"
                                name="price"
                                defaultValue={(extraFee.amountCents / 100).toFixed(2)}
                                className="input-modern text-xs pl-8 pr-2 py-1 w-24 text-center"
                              />
                            </div>
                            <button 
                              type="submit"
                              className="btn-modern bg-orange-100 text-orange-600 px-2 py-1 text-xs hover:bg-orange-200 transition-colors"
                              title="更新价格"
                            >
                              ✓
                            </button>
                          </form>
                        ) : (
                          <span className="font-semibold text-orange-600">
                            RM {(extraFee.amountCents / 100).toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {!extraFee.endTerm ? (
                          <form 
                            action={`/api/extra-fees/${extraFee.id}/update-start`} 
                            method="post"
                            className="flex items-center space-x-2"
                          >
                            <select 
                              name="startTermId" 
                              defaultValue={extraFee.startTermId}
                              className="input-modern text-xs px-2 py-1 w-32"
                            >
                              {terms.map(t => (
                                <option key={t.id} value={t.id}>
                                  {formatTermLabel(t.year, t.termIndex, terms)}
                                </option>
                              ))}
                            </select>
                            <button 
                              type="submit"
                              className="btn-modern bg-orange-100 text-orange-600 px-2 py-1 text-xs hover:bg-orange-200 transition-colors"
                              title="更新开始学期"
                            >
                              ✓
                            </button>
                          </form>
                        ) : extraFee.startTerm ? (
                          <div>
                            <div className="font-medium">{formatTermLabel(extraFee.startTerm.year, extraFee.startTerm.termIndex, terms)}</div>
                            <div className="text-xs text-gray-500">
                              {formatDate(extraFee.startTerm.startDate)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-500">未设置</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {extraFee.endTerm ? (
                          <div>
                            <div className="font-medium">{formatTermLabel(extraFee.endTerm.year, extraFee.endTerm.termIndex, terms)}</div>
                            <div className="text-xs text-gray-500">
                              {formatDate(extraFee.endTerm.endDate)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-green-600 font-medium">进行中</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          extraFee.endTerm 
                            ? 'bg-gray-100 text-gray-700' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {extraFee.endTerm ? '已结束' : '有效'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {!extraFee.endTerm && (
                          <form action={`/api/extra-fees/${extraFee.id}/end`} method="post" className="inline-flex items-center space-x-2">
                            <select name="endTermId" className="input-modern text-xs px-2 py-1">
                              {terms
                                .filter(t => 
                                  !extraFee.startTerm || 
                                  (t.year > extraFee.startTerm.year || 
                                   (t.year === extraFee.startTerm.year && t.termIndex >= extraFee.startTerm.termIndex))
                                )
                                .map(t => (
                                  <option key={t.id} value={t.id}>
                                    {formatTermLabel(t.year, t.termIndex, terms)}
                                  </option>
                                ))}
                            </select>
                            <button className="btn-modern bg-red-100 text-red-600 px-3 py-1 text-xs hover:bg-red-200 transition-colors">
                              设最后收费学期
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="text-lg font-medium text-gray-800 mb-2">暂无额外费用记录</h3>
              <p className="text-gray-600">可在上方「新增选课」或下方「新增收费分段」中添加</p>
            </div>
          )}

          <AddExtraFeeSegment
            studentId={student.id}
            feeTypes={extraFees}
            terms={terms.map((t) => ({
              id: t.id,
              period: t.period,
              label: formatTermLabel(t.year, t.termIndex, terms),
            }))}
          />
        </div>
      </div>
    </div>
  );
}


