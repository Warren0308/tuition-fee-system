import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

/**
 * 通过 _method 字段支持 PATCH / DELETE
 * - PATCH: 更新教师基本信息（name, email, phone, userId）
 * - DELETE: 删除教师（先解除课程绑定）
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const teacherId = params.id;
  const contentType = req.headers.get("content-type") || "";

  let body: any;
  let methodOverride: string;

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
      // 先解除课程绑定
      await prisma.teacherCourse.deleteMany({ where: { teacherId } });
      await prisma.teacher.delete({ where: { id: teacherId } });

      const acceptHtml = req.headers.get("accept")?.includes("text/html");
      if (acceptHtml && !contentType.includes("application/json")) {
        return NextResponse.redirect(new URL("/teachers", req.url));
      }
      return NextResponse.json({ ok: true });
    }

    // PATCH
    const data: any = {};
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "教师姓名不能为空" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.email !== undefined) {
      const email = String(body.email).trim();
      data.email = email || null;
    }
    if (body.phone !== undefined) {
      const phone = String(body.phone).trim();
      data.phone = phone || null;
    }
    if (body.userId !== undefined) {
      const userId = String(body.userId).trim();
      if (userId) {
        const existing = await prisma.teacher.findUnique({ where: { userId } });
        if (existing && existing.id !== teacherId) {
          return NextResponse.json(
            { error: "该用户已绑定到其他教师记录" },
            { status: 400 }
          );
        }
        data.userId = userId;
      } else {
        data.userId = null;
      }
    }

    await prisma.teacher.update({ where: { id: teacherId }, data });

    const acceptHtml = req.headers.get("accept")?.includes("text/html");
    if (acceptHtml && !contentType.includes("application/json")) {
      return NextResponse.redirect(new URL(`/teachers/${teacherId}`, req.url));
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("更新教师失败:", error);
    return NextResponse.json(
      { error: error.message || "操作失败" },
      { status: 500 }
    );
  }
}
