import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const form = await req.formData();
  const userId = String(form.get("userId") || "");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
  await prisma.user.update({ where: { id: userId }, data: { isActive: !user.isActive } });
  return NextResponse.redirect(new URL("/admin/users", req.url));
}


