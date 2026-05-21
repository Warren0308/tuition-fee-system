import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CustomFeeInput } from "./CustomFeeInput";
import { EditPaymentAddOns } from "./EditPaymentAddOns";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { formatTermLabelFull } from "@/lib/term-utils";
import { toPaymentHistorySnapshots } from "@/lib/billing-history-utils";

async function getData(paymentId: string) {
  const [payment, academicTerms] = await Promise.all([
    prisma.studentTermPayment.findUnique({
    where: { id: paymentId },
    include: { 
      items: true, 
      student: {
        include: { 
          grade: true,
          enrollments: {
            include: {
              course: {
                include: { fees: true }
              }
            }
          }
        }
      }
    },
  }),
    getAcademicYearTerms(),
  ]);

  if (!payment) return null;

  const termLabels = academicTerms.map((t) => ({
    year: t.year,
    termIndex: t.termIndex,
    period: t.period,
  }));

  // 获取学期信息
  const term =
    academicTerms.find(
      (t) => t.year === payment.year && t.termIndex === payment.termIndex
    ) ??
    (await prisma.term.findFirst({
      where: {
        year: payment.year,
        termIndex: payment.termIndex,
      },
    }));

  const termId = term?.id;

  // 筛选在该学期有效的选课记录
  const validEnrollments = termId
    ? payment.student.enrollments.filter(e =>
        e.startTermId <= termId &&
        (!e.endTermId || e.endTermId >= termId)
      )
    : [];

  // 获取在该学期有效的额外费用
  let validExtraFees: Array<{
    id: number;
    extraFeeTypeId: number;
    amountCents: number;
    extraFeeType: { id: number; name: string; code: string };
  }> = [];
  
  try {
    const allExtraFees = await prisma.studentExtraFee.findMany({
      where: { studentId: payment.studentId },
      include: { extraFeeType: true }
    });
    
    validExtraFees = termId
      ? allExtraFees.filter(fee =>
          fee.startTermId <= termId &&
          (!fee.endTermId || fee.endTermId >= termId)
        )
      : [];
  } catch (e) {
    console.log('获取额外费用失败');
  }

  // 获取所有额外费用类型（用于临时勾选）
  const extraFeeTypes = await prisma.extraFeeType.findMany({
    where: { isActive: true }
  }).catch(() => []);

  // 该学生其他学期的历史账单（供老师参考/复制项目）
  const pastPaymentsRaw = await prisma.studentTermPayment.findMany({
    where: {
      studentId: payment.studentId,
      id: { not: payment.id },
    },
    include: { items: true },
    orderBy: [{ year: "desc" }, { termIndex: "desc" }],
  });
  const pastPayments = toPaymentHistorySnapshots(pastPaymentsRaw, termLabels);

  return { payment, validEnrollments, validExtraFees, extraFeeTypes, pastPayments, termLabels };
}

function formatMoney(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2);
}

export default async function EditPaymentPage({ params }: { params: { paymentId: string } }) {
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

  const { payment, validEnrollments, validExtraFees, extraFeeTypes, pastPayments, termLabels } = data;

  // 找出已支付的课程ID和额外费用ID
  const paidCourseIds = payment.items
    .filter(i => i.itemType === 'COURSE' && i.refId)
    .map(i => i.refId);
  
  const paidExtraFeeIds = payment.items
    .filter(i => i.itemType === 'EXTRA_FEE' && i.refId)
    .map(i => i.refId);

  // 找出已添加的临时额外费用ID
  const paidTempExtraFeeIds = payment.items
    .filter(i => i.itemType === 'TEMP_EXTRA_FEE' && i.refId)
    .map(i => i.refId);

  // 找出未使用的额外费用类型（用于临时勾选）
  // 排除已注册的、已添加的正常额外费用、已添加的临时额外费用
  const registeredExtraFeeTypeIds = validExtraFees.map(f => f.extraFeeTypeId);
  const unusedExtraFeeTypes = extraFeeTypes.filter(t => 
    !registeredExtraFeeTypeIds.includes(t.id) && 
    !paidExtraFeeIds.includes(t.id) &&
    !paidTempExtraFeeIds.includes(t.id)
  );

  // 找出未支付的课程（优先使用选课自定义价）
  const unpaidCourses = validEnrollments.filter(e => 
    !paidCourseIds.includes(e.courseId)
  ).map(e => {
    const fee = e.course.fees?.find((f: any) => f.gradeId === payment.student.gradeId);
    const defaultPrice = fee?.amountCents || 0;
    return {
      id: e.courseId,
      name: e.course.name,
      code: e.course.code,
      price: e.customPriceCents ?? defaultPrice,
      hasCustomPrice: e.customPriceCents != null,
      defaultPrice,
    };
  });

  // 找出未支付的额外费用
  const unpaidExtraFees = validExtraFees.filter(f => 
    !paidExtraFeeIds.includes(f.extraFeeTypeId)
  );

  const total = payment.items.reduce((s, i) => s + i.finalCents, 0);

  const currentItemSnapshots = payment.items.map((i) => ({
    itemType: i.itemType,
    refId: i.refId,
    description: i.description,
    unitCents: i.unitCents,
    quantity: i.quantity,
    fraction: i.fraction,
    finalCents: i.finalCents,
    note: i.note,
  }));

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* 页面标题和导航 */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">✏️ 修改账单</h1>
            <p className="text-gray-600">
              修改 <span className="font-medium text-blue-600">{payment.student.fullName}</span> 的 
              {formatTermLabelFull(payment.year, payment.termIndex, termLabels)}账单
            </p>
          </div>
          <div className="flex gap-3">
            <Link 
              href={`/billing/receipt/${payment.id}`}
              className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
            >
              ← 返回收据
            </Link>
            <Link 
              href={`/students/${payment.studentId}`}
              className="btn-modern bg-blue-100 text-blue-600 px-4 py-2 hover:bg-blue-200"
            >
              👤 学生详情
            </Link>
          </div>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="max-w-4xl mx-auto">
        <div className="card-modern">
          {/* 学生信息头部 */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-6 border-b border-gray-200 rounded-t-xl">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">
                📋
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{payment.student.fullName}</h2>
                <div className="flex items-center space-x-3 text-sm text-gray-600">
                  <span>{payment.student.grade?.name || '未分配年级'}</span>
                  <span>•</span>
                  <span>{formatTermLabelFull(payment.year, payment.termIndex, termLabels)}</span>
                  <span>•</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    payment.paidAt 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {payment.paidAt ? '已付款' : '待付款'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 费用类型说明 */}
          <div className="mx-6 mt-6 bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700">
            <p className="font-medium text-slate-900 mb-2">📌 各类费用应在哪里改？</p>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <span className="font-medium">补习班 / 功课班</span>
                <p className="text-slate-600 mt-0.5">
                  长期标准价 →{" "}
                  <Link href={`/students/${payment.studentId}/enroll`} className="text-blue-600 underline">
                    选课管理
                  </Link>
                  ；本期账单金额 → 上方「最终金额」或下方「添加未支付项目」
                </p>
              </div>
              <div>
                <span className="font-medium">交通 / 膳食</span>
                <p className="text-slate-600 mt-0.5">
                  长期注册价 →{" "}
                  <Link href={`/students/${payment.studentId}/enroll`} className="text-blue-600 underline">
                    选课管理 · 额外费用
                  </Link>
                  ；从往期复制 → 历史参考（勿重复勾选临时额外）
                </p>
              </div>
              <div>
                <span className="font-medium">历史参考</span>
                <p className="text-slate-600 mt-0.5">快速复制往期项目；复制后可在「最终金额」改为本期实际收费（如 RM200）</p>
              </div>
              <div>
                <span className="font-medium">自定义费用</span>
                <p className="text-slate-600 mt-0.5">仅用于<strong>报名费、材料费、活动费</strong>等杂项，不是补习班学费</p>
              </div>
            </div>
          </div>

          {/* 表单 */}
          <form action={`/api/billing/payment/${payment.id}/items`} method="post" className="p-6">
            <input type="hidden" name="paymentId" value={payment.id} />

            {/* 现有费用项目 */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">💰</span> 已有费用项目
              </h3>
              
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-3 text-center text-sm font-semibold text-gray-600 w-16">删除</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">项目名称</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 w-28">原价</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 w-24">份额</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 w-24">数量</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-600 w-32">最终金额</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-600">备注</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payment.items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50 group">
                        <td className="px-3 py-3 text-center">
                          <input 
                            type="checkbox"
                            name="deleteItemIds"
                            value={item.id}
                            className="w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                            title="勾选以删除此项目"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-800 group-has-[:checked]:line-through group-has-[:checked]:text-gray-400">{item.description}</div>
                          <div className="text-xs text-gray-500">
                            {item.itemType === 'COURSE' ? '📚 课程' : 
                             item.itemType === 'EXTRA_FEE' ? '🍽️ 额外费用' : 
                             item.itemType === 'TEMP_EXTRA_FEE' ? '🚌 临时额外费用' :
                             item.itemType === 'CUSTOM_FEE' ? '✏️ 自定义费用' : '📋 其他'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-gray-600 font-medium group-has-[:checked]:line-through group-has-[:checked]:text-gray-400">{formatMoney(item.unitCents)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            name={`fraction_${item.id}`} 
                            defaultValue={String(item.fraction)} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 group-has-[:checked]:opacity-50" 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            name={`quantity_${item.id}`} 
                            defaultValue={String(item.quantity)} 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 group-has-[:checked]:opacity-50" 
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">RM</span>
                            <input 
                              name={`finalCents_${item.id}`} 
                              defaultValue={centsToInput(item.finalCents)} 
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-center text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 group-has-[:checked]:opacity-50" 
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input 
                            name={`note_${item.id}`} 
                            defaultValue={item.note ?? ''} 
                            placeholder="添加备注..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 group-has-[:checked]:opacity-50" 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-4 text-right font-semibold text-gray-700">
                        当前合计
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-xl font-bold text-green-600">{formatMoney(total)}</span>
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 历史参考 + 临时额外（联动去重） */}
            <EditPaymentAddOns
              pastPayments={pastPayments}
              currentItems={currentItemSnapshots}
              unusedExtraFeeTypes={unusedExtraFeeTypes}
              studentId={payment.studentId}
            />

            {/* 未支付项目 - 可添加 */}
            {(unpaidCourses.length > 0 || unpaidExtraFees.length > 0) && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">➕</span> 添加未支付项目
                  <span className="ml-2 text-sm font-normal text-yellow-600">
                    （来自选课记录，价格可在{" "}
                    <Link href={`/students/${payment.studentId}/enroll`} className="underline">
                      选课管理
                    </Link>{" "}
                    长期修改）
                  </span>
                </h3>
                
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="space-y-3">
                    {/* 未支付的课程 */}
                    {unpaidCourses.map(course => (
                      <div key={`course_${course.id}`} className="flex items-center justify-between p-3 bg-white border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <input 
                            type="checkbox" 
                            name="addCourseIds"
                            value={course.id}
                            className="w-5 h-5 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                          />
                          <div>
                            <div className="font-medium text-gray-800">📚 {course.name}</div>
                            <div className="text-xs text-gray-500">
                              {course.code}
                              {course.hasCustomPrice && (
                                <span className="text-orange-600 ml-1">· 选课自定义价</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-sm text-gray-500">
                            {course.hasCustomPrice ? (
                              <>选课价: {formatMoney(course.price)} · 标准: {formatMoney(course.defaultPrice)}</>
                            ) : (
                              <>原价: {formatMoney(course.price)}</>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">RM</span>
                            <input 
                              type="number"
                              step="0.01"
                              name={`addCourse_${course.id}_price`}
                              defaultValue={centsToInput(course.price)}
                              className="w-28 pl-10 pr-2 py-2 border border-yellow-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                            />
                          </div>
                          <input 
                            type="hidden"
                            name={`addCourse_${course.id}_name`}
                            value={course.name}
                          />
                        </div>
                      </div>
                    ))}
                    
                    {/* 未支付的额外费用 */}
                    {unpaidExtraFees.map(fee => (
                      <div key={`extra_${fee.extraFeeTypeId}`} className="flex items-center justify-between p-3 bg-white border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <input 
                            type="checkbox" 
                            name="addExtraFeeIds"
                            value={fee.extraFeeTypeId}
                            className="w-5 h-5 text-yellow-600 rounded border-gray-300 focus:ring-yellow-500"
                          />
                          <div>
                            <div className="font-medium text-gray-800">🍽️ {fee.extraFeeType.name}</div>
                            <div className="text-xs text-gray-500">{fee.extraFeeType.code}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-sm text-gray-500">
                            原价: {formatMoney(fee.amountCents)}
                          </div>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">RM</span>
                            <input 
                              type="number"
                              step="0.01"
                              name={`addExtra_${fee.extraFeeTypeId}_price`}
                              defaultValue={centsToInput(fee.amountCents)}
                              className="w-28 pl-10 pr-2 py-2 border border-yellow-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                            />
                          </div>
                          <input 
                            type="hidden"
                            name={`addExtra_${fee.extraFeeTypeId}_name`}
                            value={fee.extraFeeType.name}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-yellow-700 mt-3">
                    ⚠️ 勾选以上项目后点击"保存修改"，将把这些项目添加到账单中（可修改金额）
                  </p>
                </div>
              </div>
            )}

            {/* 自定义费用 */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">✏️</span> 自定义费用
                <span className="ml-2 text-sm font-normal text-purple-600">
                  （报名费、材料费、活动费等杂项 — 不是补习班学费）
                </span>
              </h3>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <CustomFeeInput />
                <p className="text-sm text-purple-700 mt-3">
                  💡 补习班/功课班学费请在「选课管理」设标准价，或在本页上方修改「最终金额」
                </p>
              </div>
            </div>

            {/* 提示信息 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-3">
                <span className="text-blue-600 text-xl">💡</span>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">修改说明</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li><strong>删除</strong>：勾选要删除的项目，保存后将从账单中移除</li>
                    <li><strong>原价</strong>：显示该项目的标准价格（不可修改）</li>
                    <li><strong>份额</strong>：用于按比例计算，如半月只需付 0.5</li>
                    <li><strong>数量</strong>：项目数量，通常为 1</li>
                    <li><strong>最终金额</strong>：实际收费金额，可直接修改</li>
                    <li><strong>历史参考</strong>：可勾选往期账单项目复制到本期（如第5期学费已收但选课记录尚未更新）</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Link 
                href={`/billing/receipt/${payment.id}`}
                className="btn-modern bg-gray-200 text-gray-700 px-6 py-3 hover:bg-gray-300"
              >
                取消修改
              </Link>
              <button 
                name="_action" 
                value="save" 
                className="btn-modern bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 font-medium"
              >
                💾 保存修改
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
