import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

const ADMIN_LINKS = [
  {
    href: "/admin/terms",
    icon: "📅",
    title: "学期设置",
    desc: "创建学期、调整日期、查看影响",
    color: "from-blue-400 to-cyan-500",
  },
  {
    href: "/admin/catalog",
    icon: "📚",
    title: "数据资料管理",
    desc: "年级、学校、课程、监护人关系、费用",
    color: "from-purple-400 to-pink-500",
  },
  {
    href: "/admin/users",
    icon: "👤",
    title: "用户与权限",
    desc: "添加用户、分配角色、激活/停用",
    color: "from-emerald-400 to-teal-500",
  },
  {
    href: "/admin/reports",
    icon: "📊",
    title: "报表中心",
    desc: "收入统计、未付分析、课程热度",
    color: "from-pink-400 to-rose-500",
  },
  {
    href: "/admin/audit",
    icon: "📜",
    title: "审计日志",
    desc: "查看所有数据变更记录",
    color: "from-amber-400 to-orange-500",
  },
  {
    href: "/admin/tools",
    icon: "🔧",
    title: "管理工具",
    desc: "导出 / 清理 / 种子数据 / 邮件测试",
    color: "from-gray-400 to-gray-600",
  },
];

export default async function AdminIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/admin");

  const roles = (session as any).roles as string[] | undefined;
  if (!roles?.includes("ADMIN")) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center max-w-md">
          <div className="text-5xl mb-3">⛔</div>
          <h2 className="text-xl font-bold mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">您没有访问管理面板的权限</p>
          <Link
            href="/dashboard"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            ← 返回工作台
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">⚙️</span>
              管理面板
            </h1>
            <p className="text-gray-600 mt-1">系统配置、数据管理、报表分析</p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← 返回工作台
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ADMIN_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="group">
              <div className="card-modern p-5 hover:shadow-lg transition-all duration-200 h-full">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${link.color} flex items-center justify-center text-white text-2xl flex-shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    {link.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {link.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">{link.desc}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
