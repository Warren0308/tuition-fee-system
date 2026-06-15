"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function Navigation() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 路由变化关闭抽屉
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!mounted || status === "loading") return null;
  if (!session) return null;

  const isAdmin = (session as any).roles?.includes("ADMIN");

  return (
    <>
      <nav className="nav-modern sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2 md:gap-8">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 -ml-2 text-gray-700"
                aria-label="菜单"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              <Link href="/dashboard" className="text-base md:text-xl font-bold text-gradient">
                🎓 <span className="hidden sm:inline">优特学院管理系统</span>
                <span className="sm:hidden">优特</span>
              </Link>

              {/* Desktop Nav */}
              <div className="hidden md:flex space-x-1">
                <NavLink href="/students" icon="👥" label="学生管理" />
                <NavLink href="/search" icon="🔍" label="查询" />
                <NavLink href="/teachers" icon="👨‍🏫" label="老师" />
                <NavLink href="/schedule" icon="📅" label="课表" />
                {isAdmin && (
                  <div className="relative group">
                    <button className="nav-item px-4 py-2 rounded-xl transition-all hover:bg-gradient-secondary hover:text-white flex items-center gap-2">
                      <span>⚙️</span>
                      <span>管理</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <div className="absolute left-0 mt-2 w-56 card-modern rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 z-50">
                      <div className="py-2">
                        <DropdownLink href="/admin" icon="🏛️" label="管理面板" />
                        <DropdownLink href="/admin/terms" icon="📅" label="学期设置" />
                        <DropdownLink href="/admin/catalog" icon="📚" label="数据资料" />
                        <DropdownLink href="/admin/users" icon="👤" label="用户与权限" />
                        <DropdownLink href="/admin/reports" icon="📊" label="报表中心" />
                        <DropdownLink href="/admin/audit" icon="📜" label="审计日志" />
                        <DropdownLink href="/admin/tools" icon="🔧" label="管理工具" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/30 rounded-lg">
                <div className="w-7 h-7 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold text-xs">
                  {session.user?.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {session.user?.name}
                </span>
              </div>

              <Link
                href="/profile"
                className="p-2 rounded-lg hover:bg-white/30 transition-all"
                aria-label="个人资料"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-2 rounded-lg hover:bg-red-50 transition-all"
                aria-label="登出"
              >
                <svg className="w-5 h-5 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <div className="px-2 py-3 space-y-1">
              <div className="px-3 py-2 mb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                    {session.user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{session.user?.name}</div>
                    <div className="text-xs text-gray-500">
                      {isAdmin ? "管理员" : (session as any).roles?.join("、") || "用户"}
                    </div>
                  </div>
                </div>
              </div>

              <MobileLink href="/dashboard" icon="🏠" label="工作台" pathname={pathname} />
              <MobileLink href="/students" icon="👥" label="学生管理" pathname={pathname} />
              <MobileLink href="/search" icon="🔍" label="查询" pathname={pathname} />
              <MobileLink href="/teachers" icon="👨‍🏫" label="老师" pathname={pathname} />
              <MobileLink href="/schedule" icon="📅" label="课表" pathname={pathname} />
              <MobileLink href="/billing/batch" icon="⚡" label="批量结算" pathname={pathname} />
              <MobileLink href="/billing/unpaid" icon="⏰" label="待支付账单" pathname={pathname} />
              <MobileLink href="/billing/ledger" icon="📋" label="缴费台账" pathname={pathname} />
              <MobileLink href="/stats" icon="📊" label="统计分析" pathname={pathname} />

              {isAdmin && (
                <>
                  <div className="px-3 pt-2 pb-1 text-xs text-gray-500 font-semibold uppercase">管理</div>
                  <MobileLink href="/admin" icon="🏛️" label="管理面板" pathname={pathname} />
                  <MobileLink href="/admin/terms" icon="📅" label="学期设置" pathname={pathname} />
                  <MobileLink href="/admin/catalog" icon="📚" label="数据资料" pathname={pathname} />
                  <MobileLink href="/admin/users" icon="👤" label="用户与权限" pathname={pathname} />
                  <MobileLink href="/admin/reports" icon="📊" label="报表中心" pathname={pathname} />
                  <MobileLink href="/admin/audit" icon="📜" label="审计日志" pathname={pathname} />
                  <MobileLink href="/admin/tools" icon="🔧" label="管理工具" pathname={pathname} />
                </>
              )}

              <div className="border-t border-gray-100 pt-2 mt-2">
                <MobileLink href="/profile" icon="👤" label="个人资料" pathname={pathname} />
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-600 hover:bg-red-50"
                >
                  <span className="text-xl">🚪</span>
                  <span className="font-medium">退出登录</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 h-14">
          <BottomNavLink href="/dashboard" icon="🏠" label="工作台" pathname={pathname} />
          <BottomNavLink href="/students" icon="👥" label="学生" pathname={pathname} />
          <BottomNavLink href="/search" icon="🔍" label="查询" pathname={pathname} />
          <BottomNavLink href="/billing/unpaid" icon="⏰" label="待付" pathname={pathname} />
          <BottomNavLink href="/profile" icon="👤" label="我的" pathname={pathname} />
        </div>
      </div>

      {/* Bottom nav placeholder spacer — matches bar height + safe-area */}
      <div
        className="md:hidden"
        style={{ height: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden="true"
      />
    </>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="nav-item px-3 py-2 rounded-xl transition-all hover:bg-gradient-primary hover:text-white text-sm"
    >
      <span className="flex items-center gap-1">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
    </Link>
  );
}

function DropdownLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gradient-primary hover:text-white transition-all rounded-lg mx-2 text-sm"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

function MobileLink({
  href,
  icon,
  label,
  pathname,
}: {
  href: string;
  icon: string;
  label: string;
  pathname: string | null;
}) {
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
        isActive ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function BottomNavLink({
  href,
  icon,
  label,
  pathname,
}: {
  href: string;
  icon: string;
  label: string;
  pathname: string | null;
}) {
  const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 ${
        isActive ? "text-blue-600" : "text-gray-600"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
