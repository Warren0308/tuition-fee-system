import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportClient } from "./ImportClient";

export default async function StudentImportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/students/import");

  const roles = (session as any).roles as string[] | undefined;
  if (!roles?.includes("ADMIN")) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-3">⛔</div>
          <h2 className="text-xl font-bold mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">只有管理员可以批量导入学生</p>
          <Link href="/students" className="text-blue-600 hover:underline">← 返回学生列表</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">📤</span>
              批量导入学生
            </h1>
            <p className="text-gray-600 mt-1">通过 CSV 文件一次性导入多位学生</p>
          </div>
          <Link
            href="/students"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← 返回学生列表
          </Link>
        </div>

        {/* CSV 模板说明 */}
        <div className="card-modern p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">📋 CSV 格式说明</h2>
          <p className="text-sm text-gray-600">
            第一行必须是表头，列的顺序可以随意，但列名必须完全匹配下表。<br />
            <span className="text-red-500">*</span> 表示必填项。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">列名</th>
                  <th className="px-3 py-2 text-left">说明</th>
                  <th className="px-3 py-2 text-left">示例</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr><td className="px-3 py-2 font-mono"><span className="text-red-500">*</span>fullName</td><td>学生姓名</td><td className="text-gray-500">张小明</td></tr>
                <tr><td className="px-3 py-2 font-mono"><span className="text-red-500">*</span>gradeName</td><td>年级名（需在字典中存在）</td><td className="text-gray-500">五年级</td></tr>
                <tr><td className="px-3 py-2 font-mono">gender</td><td>M / F / 男 / 女</td><td className="text-gray-500">M</td></tr>
                <tr><td className="px-3 py-2 font-mono">dateOfBirth</td><td>出生日期 YYYY-MM-DD</td><td className="text-gray-500">2014-03-15</td></tr>
                <tr><td className="px-3 py-2 font-mono">schoolName</td><td>学校名（不存在跳过）</td><td className="text-gray-500">优特小学</td></tr>
                <tr><td className="px-3 py-2 font-mono">className</td><td>班级</td><td className="text-gray-500">5甲</td></tr>
                <tr><td className="px-3 py-2 font-mono">address</td><td>地址</td><td className="text-gray-500">JB Tampoi</td></tr>
                <tr><td className="px-3 py-2 font-mono">guardianName</td><td>主要监护人姓名</td><td className="text-gray-500">张爸爸</td></tr>
                <tr><td className="px-3 py-2 font-mono">guardianPhone</td><td>监护人电话</td><td className="text-gray-500">0123456789</td></tr>
                <tr><td className="px-3 py-2 font-mono">guardianRelation</td><td>关系（需在字典中）</td><td className="text-gray-500">父亲</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-3 rounded">
            <strong>⚠️ 注意：</strong>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>年级、学校、监护人关系会按名称匹配字典，不存在的会跳过该字段或整行</li>
              <li>导入前请先在 <Link href="/admin/catalog/dicts" className="underline">字典管理</Link> 中确保相关数据已存在</li>
              <li>建议先用"试运行"检查格式正确，再正式导入</li>
            </ul>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-blue-600 hover:underline">📥 查看示例 CSV</summary>
            <pre className="mt-2 p-3 bg-gray-900 text-gray-100 rounded text-xs overflow-x-auto">
{`fullName,gradeName,gender,dateOfBirth,schoolName,className,guardianName,guardianPhone,guardianRelation
张小明,五年级,M,2014-03-15,优特小学,5甲,张爸爸,0123456789,父亲
李小华,四年级,F,2015-06-20,优特小学,4乙,李妈妈,0198765432,母亲
王大力,六年级,M,,优特小学,6甲,王爸爸,0111223344,父亲`}
            </pre>
          </details>
        </div>

        {/* 上传区域 */}
        <ImportClient />
      </div>
    </div>
  );
}
