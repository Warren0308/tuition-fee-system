import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const form = await req.formData();
  const userId = String(form.get("userId") || "");
  const roleCode = String(form.get("roleCode") || "").trim();
  const action = String(form.get("_action") || "add");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return NextResponse.json({ ok: false, error: "用户不存在" }, { status: 404 });
  const role = await prisma.role.findUnique({ where: { code: roleCode as any } });
  if (!role) return NextResponse.json({ ok: false, error: "角色不存在" }, { status: 400 });
  if (action === "add") {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  } else {
    await prisma.userRole.delete({ where: { userId_roleId: { userId, roleId: role.id } } }).catch(() => {});
  }
  return NextResponse.redirect(new URL("/admin/users", req.url));
}


