import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentOrLatestTerm } from "@/lib/billing-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { ScheduleManager } from "./ScheduleManager";
import { formatTermLabel } from "@/lib/term-utils";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams?: { termId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/schedule");

  const roles = (session as any).roles as string[] | undefined;
  const isAdmin = roles?.includes("ADMIN");
  const isTeacher = roles?.includes("TEACHER");

  let terms, courses, currentTerm;
  try {
    [terms, courses, currentTerm] = await Promise.all([
      getAcademicYearTerms(),
      prisma.course.findMany({
        where: { isActive: true },
        include: { dict: { include: { type: true } }, teachers: { include: { teacher: true } } },
        orderBy: { name: "asc" },
      }),
      getCurrentOrLatestTerm(),
    ]);
  } catch (e) {
    console.error("SchedulePage data fetch error:", e);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">数据加载失败</h2>
          <p className="text-gray-600 mb-4">请刷新页面重试</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">← 返回工作台</Link>
        </div>
      </div>
    );
  }

  const billingTerms = terms;

  const selectedTermId = searchParams?.termId
    ? Number(searchParams.termId)
    : currentTerm?.id ?? billingTerms[billingTerms.length - 1]?.id;

  const selectedTerm = billingTerms.find((t) => t.id === selectedTermId);

  if (!selectedTerm) {
    return (
      <div className="min-h-screen p-6">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-600 mb-4">系统中尚未生成任何学期</p>
          {isAdmin && (
            <Link
              href="/admin/terms"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              去创建学期
            </Link>
          )}
        </div>
      </div>
    );
  }

  // 教师只能看到自己负责的课程
  let visibleCourses = courses;
  if (!isAdmin && isTeacher) {
    const myTeacher = await prisma.teacher.findFirst({
      where: { user: { username: session.user?.name || "" } },
      include: { courses: true },
    });
    const myCourseIds = new Set(myTeacher?.courses.map((c) => c.courseId) || []);
    visibleCourses = courses.filter((c) => myCourseIds.has(c.id));
  }

  // 查询该学期的所有课表
  const scheduleWhere: any = { termId: selectedTerm.id };
  if (!isAdmin && isTeacher) {
    scheduleWhere.courseId = { in: visibleCourses.map((c) => c.id) };
  }
  const schedules = await prisma.courseSchedule.findMany({
    where: scheduleWhere,
    include: {
      course: {
        include: {
          dict: { include: { type: true } },
          teachers: { include: { teacher: true } },
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">📅</span>
              课表管理
            </h1>
            <p className="text-gray-600 mt-1">
              {isAdmin
                ? "管理每个学期的课程时间安排"
                : "查看您负责的课程时间安排"}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
          >
            ← 返回工作台
          </Link>
        </div>

        {/* 学期切换 */}
        <div className="card-modern p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-600">选择学期：</span>
            <div className="flex flex-wrap gap-2">
              {billingTerms.map((t) => (
                <Link
                  key={t.id}
                  href={`/schedule?termId=${t.id}`}
                  className={`px-3 py-1.5 rounded text-sm ${
                    t.id === selectedTermId
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {formatTermLabel(t.year, t.termIndex, billingTerms)}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <ScheduleManager
          termId={selectedTerm.id}
          termLabel={`${selectedTerm.year} 年第 ${selectedTerm.termIndex} 期`}
          canEdit={!!isAdmin}
          courses={visibleCourses.map((c) => ({
            id: c.id,
            name: c.name,
            typeName: c.dict?.type?.name || "未分类",
            teacherNames: c.teachers.map((tc) => tc.teacher.name),
          }))}
          schedules={schedules.map((s) => ({
            id: s.id,
            courseId: s.courseId,
            courseName: s.course.name,
            typeName: s.course.dict?.type?.name || "未分类",
            teacherNames: s.course.teachers.map((tc) => tc.teacher.name),
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          }))}
        />
      </div>
    </div>
  );
}
