import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  CREATE: { label: "创建学生", color: "bg-green-100 text-green-800", icon: "➕" },
  UPDATE: { label: "更新资料", color: "bg-blue-100 text-blue-800", icon: "✏️" },
  DEACTIVATE: { label: "停用账户", color: "bg-amber-100 text-amber-800", icon: "⏸" },
  RESTORE: { label: "启用账户", color: "bg-emerald-100 text-emerald-800", icon: "▶️" },
  STOP_TUTORING: { label: "停止补习", color: "bg-gray-100 text-gray-800", icon: "🛑" },
  RESUME_TUTORING: { label: "恢复在读", color: "bg-emerald-100 text-emerald-800", icon: "🎓" },
  DATA_FIX: { label: "数据修正", color: "bg-orange-100 text-orange-800", icon: "🔧" },
  EXTRA_FEE_ADD: { label: "新增额外费用分段", color: "bg-orange-100 text-orange-800", icon: "🍽️" },
  TERM_FORCE_CLOSE: { label: "强制结清学期", color: "bg-slate-100 text-slate-800", icon: "✓" },
  TERM_FORCE_CLOSE_UNDO: { label: "取消强制结清", color: "bg-gray-100 text-gray-700", icon: "↩" },
  GUARDIAN_ADD: { label: "添加监护人", color: "bg-indigo-100 text-indigo-800", icon: "👨‍👩‍👧" },
  GUARDIAN_UPDATE: { label: "更新监护人", color: "bg-purple-100 text-purple-800", icon: "✏️" },
  GUARDIAN_REMOVE: { label: "移除监护人", color: "bg-red-100 text-red-800", icon: "🗑️" },
  GUARDIAN_SET_PRIMARY: { label: "设置主联系人", color: "bg-cyan-100 text-cyan-800", icon: "⭐" },
};

function formatValue(val: any): string {
  if (val === null || val === undefined) return "（空）";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

function describeDiff(before: any, after: any): { field: string; oldVal: string; newVal: string }[] {
  const result: { field: string; oldVal: string; newVal: string }[] = [];
  if (!before && !after) return result;
  const beforeObj = (before || {}) as Record<string, any>;
  const afterObj = (after || {}) as Record<string, any>;
  const allKeys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);

  for (const key of allKeys) {
    if (key === "guardians") continue; // 数组类型单独处理
    const oldV = beforeObj[key];
    const newV = afterObj[key];
    if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
      result.push({ field: key, oldVal: formatValue(oldV), newVal: formatValue(newV) });
    }
  }
  return result;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: "姓名",
  gradeId: "年级",
  schoolId: "学校",
  className: "班级",
  address: "地址",
  address2: "地址（补充）",
  city: "城市",
  state: "州/省",
  postcode: "邮编",
  gender: "性别",
  dateOfBirth: "出生日期",
  isActive: "是否启用",
  name: "姓名",
  phone: "电话",
  relationTypeId: "关系",
  isPrimary: "主要联系人",
};

export default async function StudentChangeLogPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <Link className="text-blue-600 hover:underline" href="/login">
            立即登录
          </Link>
        </div>
      </div>
    );
  }

  const [student, logs] = await Promise.all([
    prisma.student.findUnique({
      where: { id: params.id },
      select: { id: true, fullName: true },
    }),
    prisma.studentChangeLog.findMany({
      where: { studentId: params.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!student) return notFound();

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">📜</span>
            修改历史
          </h1>
          <p className="text-gray-600 mt-1">{student.fullName} 的资料变更记录</p>
        </div>
        <Link
          href={`/students/${student.id}`}
          className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
        >
          ← 返回学生详情
        </Link>
      </div>

      {logs.length === 0 ? (
        <div className="card-modern p-12 text-center">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">暂无变更记录</h3>
          <p className="text-gray-600">该学生的资料尚未被修改过</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const meta = ACTION_LABELS[log.action] || {
              label: log.action,
              color: "bg-gray-100 text-gray-800",
              icon: "📝",
            };
            const diff = describeDiff(log.before, log.after);

            return (
              <div key={log.id} className="card-modern p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${meta.color}`}>
                      <span>{meta.icon}</span>
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </div>
                </div>

                {diff.length > 0 ? (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left py-1 pr-3">字段</th>
                          <th className="text-left py-1 pr-3">原值</th>
                          <th className="text-left py-1">新值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diff.map((d, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0">
                            <td className="py-1.5 pr-3 font-medium text-gray-700">
                              {FIELD_LABELS[d.field] || d.field}
                            </td>
                            <td className="py-1.5 pr-3 text-red-600 line-through">
                              {d.oldVal}
                            </td>
                            <td className="py-1.5 text-emerald-600 font-medium">
                              {d.newVal}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // 对于无 diff（如 CREATE 时只有 after）显示 after 内容
                  log.after && (
                    <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                      <pre className="whitespace-pre-wrap break-all">
                        {JSON.stringify(log.after, null, 2)}
                      </pre>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
