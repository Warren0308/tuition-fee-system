import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

async function getData() {
  const teachers = await prisma.teacher.findMany({
    include: {
      user: {
        select: { id: true, username: true, isActive: true, email: true, phone: true },
      },
      courses: {
        include: {
          course: {
            include: { dict: true },
          },
        },
      },
      _count: {
        select: { courses: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return { teachers };
}

export default async function TeachersPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login?callbackUrl=/teachers");
  }

  const roles = (session as any).roles as string[] | undefined;
  const isAdmin = roles?.includes("ADMIN");
  const isTeacher = roles?.includes("TEACHER");

  const { teachers } = await getData();

  // 老师只看到自己（暂时简化，未来可以做老师的"我的课"页）
  const visibleTeachers = isAdmin
    ? teachers
    : isTeacher
      ? teachers.filter((t) => t.user?.username === session.user?.name)
      : teachers;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">👨‍🏫</span>
            教师管理
          </h1>
          <p className="text-gray-600 mt-1">查看教师及其负责的课程</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Link
              href="/teachers/new"
              className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
            >
              ➕ 添加教师
            </Link>
          )}
          <Link
            href="/dashboard"
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
          >
            ← 返回工作台
          </Link>
        </div>
      </div>

      <div className="card-modern p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">教师列表</h2>
          <div className="text-sm text-gray-500">共 {visibleTeachers.length} 位</div>
        </div>

        {visibleTeachers.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-5xl mb-3">👨‍🏫</div>
            <p className="mb-3">暂无教师数据</p>
            {isAdmin && (
              <Link
                href="/teachers/new"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                添加第一位教师
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleTeachers.map((t) => (
              <Link
                key={t.id}
                href={`/teachers/${t.id}`}
                className="block group"
              >
                <div className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                      {t.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-800 group-hover:text-blue-600 truncate">
                        {t.name}
                      </div>
                      {t.user ? (
                        <div className="text-xs text-gray-500 mt-0.5">
                          账号: {t.user.username}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-600 mt-0.5">未绑定登录账号</div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-gray-600">
                    {t.email && <div>📧 {t.email}</div>}
                    {t.phone && <div>📞 {t.phone}</div>}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">负责课程</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {t._count.courses} 门
                      </span>
                    </div>
                    {t.courses.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {t.courses.slice(0, 3).map((tc) => (
                          <span
                            key={tc.courseId}
                            className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                          >
                            {tc.course.name}
                          </span>
                        ))}
                        {t.courses.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{t.courses.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
