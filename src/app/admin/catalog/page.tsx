import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function AdminCatalogIndex() {
  const session = await getServerSession(authOptions);
  if (!session) return <div className="p-6">未登录</div>;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">分类与费用</h1>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        <Link href="/admin/catalog/fees" className="px-4 py-3 bg-gray-200 rounded text-center">课程费用（按年级）</Link>
        <Link href="/admin/catalog/extras" className="px-4 py-3 bg-gray-200 rounded text-center">其他费用（膳食/交通）</Link>
        <Link href="/admin/catalog/dicts" className="px-4 py-3 bg-gray-200 rounded text-center">字典（年级/学校/监护人关系）</Link>
      </div>
      <div><Link href="/admin" className="text-blue-600">返回管理首页</Link></div>
    </div>
  );
}


