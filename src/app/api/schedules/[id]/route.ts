import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

/**
 * 通过 _method 支持 PATCH / DELETE
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const id = params.id;
  const contentType = req.headers.get("content-type") || "";
  let body: any;
  let methodOverride = "PATCH";
  if (contentType.includes("application/json")) {
    body = await req.json();
    methodOverride = body._method || "PATCH";
  } else {
    const form = await req.formData();
    body = Object.fromEntries(form.entries());
    methodOverride = String(body._method || "PATCH");
  }

  try {
    if (methodOverride === "DELETE") {
      await prisma.courseSchedule.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    const data: any = {};
    if (body.courseId !== undefined) data.courseId = Number(body.courseId);
    if (body.dayOfWeek !== undefined) data.dayOfWeek = Number(body.dayOfWeek);
    if (body.startTime !== undefined) data.startTime = String(body.startTime).trim();
    if (body.endTime !== undefined) data.endTime = String(body.endTime).trim();

    if (data.startTime && !/^\d{2}:\d{2}$/.test(data.startTime)) {
      return NextResponse.json({ error: "开始时间格式错误" }, { status: 400 });
    }
    if (data.endTime && !/^\d{2}:\d{2}$/.test(data.endTime)) {
      return NextResponse.json({ error: "结束时间格式错误" }, { status: 400 });
    }
    if (data.startTime && data.endTime && data.startTime >= data.endTime) {
      return NextResponse.json({ error: "开始时间必须早于结束时间" }, { status: 400 });
    }

    await prisma.courseSchedule.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("课表操作失败:", error);
    return NextResponse.json({ error: error.message || "操作失败" }, { status: 500 });
  }
}
