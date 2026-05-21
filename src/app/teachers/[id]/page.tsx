import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { TeacherEditor } from "./TeacherEditor";
import { TeacherCoursesEditor } from "./TeacherCoursesEditor";
import { DeleteTeacherButton } from "./DeleteTeacherButton";

export default async function TeacherDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/login?callbackUrl=/teachers/${params.id}`);

  const roles = (session as any).roles as string[] | undefined;
  const isAdmin = roles?.includes("ADMIN");

  const teacher = await prisma.teacher.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: { id: true, username: true, email: true, phone: true, isActive: true },
      },
      courses: {
        include: {
          course: { include: { dict: { include: { type: true } } } },
        },
      },
    },
  });

  if (!teacher) notFound();

  // 教师只能看自己
  const isTeacher = roles?.includes("TEACHER");
  if (!isAdmin && isTeacher && teacher.user?.username !== session.user?.name) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-3">⛔</div>
          <p>无权查看其他教师资料</p>
          <Link href="/teachers" className="text-blue-600 hover:underline mt-3 inline-block">← 返回</Link>
        </div>
      </div>
    );
  }

  // 所有可分配的课程
  const allCourses = await prisma.course.findMany({
    where: { isActive: true },
    include: { dict: { include: { type: true } } },
    orderBy: [{ name: "asc" }],
  });

  // 可用 user 列表（含已绑定者）
  const availableUsers = isAdmin
    ? await prisma.user.findMany({
        where: {
          OR: [
            { roles: { some: { role: { code: "TEACHER" } } } },
            { id: teacher.userId || undefined },
          ],
        },
        select: { id: true, username: true, email: true },
        orderBy: { username: "asc" },
      })
    : [];

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/teachers" className="text-sm text-gray-600 hover:text-gray-800">
            ← 返回教师列表
          </Link>
          {isAdmin && (
            <DeleteTeacherButton teacherId={teacher.id} teacherName={teacher.name} />
          )}
        </div>

        {/* 教师信息 */}
        <div className="card-modern p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
              {teacher.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-800">{teacher.name}</h1>
              {teacher.user ? (
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">
                  ✓ 已绑定账号：{teacher.user.username}
                </div>
              ) : (
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                  ⚠ 未绑定登录账号
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <TeacherEditor
                teacherId={teacher.id}
                initialName={teacher.name}
                initialEmail={teacher.email || ""}
                initialPhone={teacher.phone || ""}
                initialUserId={teacher.userId || ""}
                availableUsers={availableUsers}
              />
            </div>
          )}

          {!isAdmin && (
            <div className="mt-4 space-y-1 text-sm text-gray-600">
              {teacher.email && <div>📧 {teacher.email}</div>}
              {teacher.phone && <div>📞 {teacher.phone}</div>}
            </div>
          )}
        </div>

        {/* 负责课程 */}
        <div className="card-modern p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <span>📚</span>
            负责课程
            <span className="text-sm text-gray-500 font-normal">
              （{teacher.courses.length} 门）
            </span>
          </h2>

          {isAdmin ? (
            <TeacherCoursesEditor
              teacherId={teacher.id}
              allCourses={allCourses.map((c) => ({
                id: c.id,
                name: c.name,
                code: c.code,
                typeName: c.dict?.type?.name || "未分类",
              }))}
              initialSelected={teacher.courses.map((tc) => tc.courseId)}
            />
          ) : teacher.courses.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">暂无绑定课程</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {teacher.courses.map((tc) => (
                <div
                  key={tc.courseId}
                  className="p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <div className="font-medium text-gray-800">{tc.course.name}</div>
                  {tc.course.dict?.type && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      {tc.course.dict.type.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
