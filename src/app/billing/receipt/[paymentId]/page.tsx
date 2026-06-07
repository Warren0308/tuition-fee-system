import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ReceiptActions } from "./ReceiptActions";
import { calculateUnpaidForStudent } from "@/lib/billing-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { formatTermLabelFull } from "@/lib/term-utils";

async function getData(paymentId: string) {
  const [payment, academicTerms] = await Promise.all([
    prisma.studentTermPayment.findUnique({
      where: { id: paymentId },
      include: {
        items: true,
        student: {
          include: {
            grade: true,
            guardians: { where: { isPrimary: true }, take: 1 },
          },
        },
        term: true,
      },
    }),
    getAcademicYearTerms(),
  ]);

  if (!payment || !payment.term) return null;

  const termLabels = academicTerms.map((t) => ({
    year: t.year,
    termIndex: t.termIndex,
    period: t.period,
  }));

  let unpaidSummary;
  try {
    unpaidSummary = await calculateUnpaidForStudent(
      payment.studentId,
      payment.term.id,
      payment.student.gradeId
    );
  } catch {
    unpaidSummary = { unpaidCourses: [], unpaidExtraFees: [], unpaidTotal: 0 };
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      studentId: payment.studentId,
      startTermId: { lte: payment.term.id },
      OR: [{ endTermId: null }, { endTermId: { gte: payment.term.id } }],
    },
    select: { courseId: true, subjectCourseIds: true },
  });

  // 收集所有需要查名字的子课程 ID
  const allSubjectIds = Array.from(new Set(enrollments.flatMap((e) => e.subjectCourseIds || [])));
  const subjectCourses = allSubjectIds.length
    ? await prisma.course.findMany({
        where: { id: { in: allSubjectIds } },
        select: { id: true, name: true },
      })
    : [];
  const subjectNameMap = new Map(subjectCourses.map((c) => [c.id, c.name]));

  // courseId → 该 enrollment 关联的子科目名字列表
  const courseToSubjects = new Map<number, string[]>();
  for (const e of enrollments) {
    if (!e.subjectCourseIds || e.subjectCourseIds.length === 0) continue;
    const names = e.subjectCourseIds
      .map((sid) => subjectNameMap.get(sid))
      .filter((n): n is string => !!n)
      .map((n) => n.replace(/^.*-/, "")); // 取短名字
    if (names.length > 0) courseToSubjects.set(e.courseId, names);
  }

  return { payment, unpaidSummary, courseToSubjects, termLabels };
}

function formatMoney(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export default async function ReceiptPage({ params }: { params: { paymentId: string } }) {
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
  
  const data = await getData(params.paymentId);
  if (!data) return notFound();
  
  const { payment, unpaidSummary, courseToSubjects, termLabels } = data;
  
  const allItems = payment.items;
  const total = payment.items.reduce((s, i) => s + i.finalCents, 0);
  
  const { unpaidCourses, unpaidExtraFees, unpaidTotal } = unpaidSummary;
  const isFullyPaid = unpaidTotal === 0;
  
  const guardian = payment.student.guardians[0];

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* 操作栏 - 打印时隐藏 */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <Link 
          href={`/students/${payment.studentId}`}
          className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
        >
          ← 返回学生详情
        </Link>
        <ReceiptActions
          paymentId={payment.id}
          studentName={payment.student.fullName}
          guardianPhone={guardian?.phone}
          guardianName={guardian?.name}
        />
      </div>

      {/* 未支付项目提示 - 打印时隐藏 */}
      {!isFullyPaid && (
        <div className="max-w-3xl mx-auto mb-4 print:hidden">
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <span className="text-2xl">⚠️</span>
              <div className="flex-1">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  该学期有未支付的项目
                </h4>
                <div className="text-sm text-yellow-700 space-y-1">
                  {unpaidCourses.map(course => (
                    <div key={course.refId} className="flex justify-between">
                      <span>📚 {course.name}</span>
                      <span className="font-medium">{formatMoney(course.price)}</span>
                    </div>
                  ))}
                  {unpaidExtraFees.map(fee => (
                    <div key={fee.refId} className="flex justify-between">
                      <span>🍽️ {fee.name}</span>
                      <span className="font-medium">{formatMoney(fee.price)}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-yellow-300 flex justify-between font-semibold">
                    <span>未支付总额</span>
                    <span className="text-red-600">{formatMoney(unpaidTotal)}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/billing/edit/${payment.id}`}
                    className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                  >
                    <span className="mr-2">✏️</span>
                    修改账单添加未支付项目
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 收据主体 — PDF / 分享时截取此区域 */}
      <div
        id="receipt-document"
        className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg print:shadow-none print:rounded-none"
      >
        {/* 收据头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-lg print:rounded-none">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">🧾 收据 / Receipt</h1>
              <p className="text-blue-100 mt-1">优特学院管理系统</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-blue-100">收据编号</div>
              <div className="font-mono text-lg">{payment.id.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>
        </div>

        {/* 学生信息 */}
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-500">学生姓名</div>
              <div className="font-semibold text-lg">{payment.student.fullName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">年级</div>
              <div className="font-semibold">{payment.student.grade?.name || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">学期</div>
              <div className="font-semibold">{formatTermLabelFull(payment.year, payment.termIndex, termLabels)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">付款状态</div>
              <div className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                payment.paidAt ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {payment.paidAt ? `已付款 (${formatDate(payment.paidAt)})` : '待付款'}
              </div>
            </div>
          </div>
        </div>

        {/* 费用明细 - 整合显示 */}
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
            <span className="mr-2">💰</span> 已支付费用
          </h3>
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-sm font-semibold text-gray-600">项目</th>
                <th className="px-4 py-3 text-sm font-semibold text-gray-600 text-right">金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allItems.map(item => {
                // 如果该 item 是 COURSE 并且有子科目标签，展示在下方
                const subjects =
                  item.itemType === 'COURSE' && item.refId
                    ? courseToSubjects.get(item.refId)
                    : undefined;
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{item.description}</div>
                      <div className="text-xs text-gray-500">
                        {item.itemType === 'COURSE' ? '📚 课程' :
                         item.itemType === 'EXTRA_FEE' ? '🍽️ 额外费用' :
                         item.itemType === 'TEMP_EXTRA_FEE' ? '🚌 临时额外费用' :
                         item.itemType === 'CUSTOM_FEE' ? '✏️ 自定义费用' : '📋 其他'}
                      </div>
                      {subjects && subjects.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {subjects.map((s) => (
                            <span
                              key={s}
                              className="inline-flex px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold">
                        {formatMoney(item.finalCents)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 合计 */}
          <div className="border-t-2 border-gray-200 pt-4 mt-6">
            <div className="flex justify-between items-center">
              <span className="text-xl font-semibold text-gray-800">已支付总计</span>
              <span className="text-2xl font-bold text-green-600">{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* 收据底部 */}
        <div className="bg-gray-50 p-6 rounded-b-lg print:rounded-none border-t">
          <div className="text-center text-sm text-gray-500">
            <p>感谢您的付款！如有疑问请联系学院管理处。</p>
            <p className="mt-1">打印日期：{formatDate(new Date())}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


