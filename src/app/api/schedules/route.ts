import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/api-auth";

/**
 * GET: 查询某学期的课表
 *   ?termId=  或  ?year=2026&termIndex=1
 *   可选: courseId, dayOfWeek
 */
export async function GET(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const termIdParam = url.searchParams.get("termId");
  const year = url.searchParams.get("year");
  const termIndex = url.searchParams.get("termIndex");
  const courseIdParam = url.searchParams.get("courseId");
  const dayOfWeekParam = url.searchParams.get("dayOfWeek");

  let termId: number | undefined;
  if (termIdParam) {
    termId = Number(termIdParam);
  } else if (year && termIndex) {
    const term = await prisma.term.findFirst({
      where: { year: Number(year), termIndex: Number(termIndex) },
    });
    termId = term?.id;
  }

  if (!termId) {
    return NextResponse.json({ error: "缺少学期参数" }, { status: 400 });
  }

  const where: any = { termId };
  if (courseIdParam) where.courseId = Number(courseIdParam);
  if (dayOfWeekParam) where.dayOfWeek = Number(dayOfWeekParam);

  const schedules = await prisma.courseSchedule.findMany({
    where,
    include: {
      course: { include: { dict: { include: { type: true } }, teachers: { include: { teacher: true } } } },
      term: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ schedules });
}

/**
 * POST: 添加课表
 * Body: { termId, courseId, dayOfWeek, startTime, endTime }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const termId = Number(body.termId);
    const courseId = Number(body.courseId);
    const dayOfWeek = Number(body.dayOfWeek);
    const startTime = String(body.startTime || "").trim();
    const endTime = String(body.endTime || "").trim();

    if (!termId || !courseId || isNaN(dayOfWeek) || !startTime || !endTime) {
      return NextResponse.json({ error: "参数不完整" }, { status: 400 });
    }
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: "星期范围 0-6" }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      return NextResponse.json({ error: "时间格式应为 HH:MM" }, { status: 400 });
    }
    if (startTime >= endTime) {
      return NextResponse.json({ error: "开始时间必须早于结束时间" }, { status: 400 });
    }

    const term = await prisma.term.findUnique({ where: { id: termId } });
    if (!term) return NextResponse.json({ error: "学期不存在" }, { status: 404 });

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course) return NextResponse.json({ error: "课程不存在" }, { status: 404 });

    const schedule = await prisma.courseSchedule.create({
      data: { termId, courseId, dayOfWeek, startTime, endTime },
    });

    return NextResponse.json({ ok: true, schedule });
  } catch (error: any) {
    console.error("创建课表失败:", error);
    return NextResponse.json({ error: error.message || "创建失败" }, { status: 500 });
  }
}
