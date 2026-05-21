/**
 * 初始化内部账号：admin（全权限）、Warren（收费员 RECIPIENT）
 * 用法: npx tsx scripts/setup-internal-users.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const PASSWORD = "000000";

async function ensureRole(userId: string, roleCode: "ADMIN" | "RECIPIENT" | "TEACHER") {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) throw new Error(`角色 ${roleCode} 不存在`);
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
}

async function removeRole(userId: string, roleCode: "ADMIN" | "RECIPIENT" | "TEACHER") {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  if (!role) return;
  await prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
}

async function setupUser(
  username: string,
  opts: {
    role: "ADMIN" | "RECIPIENT";
    email?: string;
    phone?: string;
    removeRoles?: Array<"ADMIN" | "RECIPIENT" | "TEACHER">;
  }
) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  let user = await prisma.user.findUnique({ where: { username } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username,
        passwordHash: hash,
        email: opts.email ?? `${username.toLowerCase()}@system.local`,
        phone: opts.phone ?? null,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`✅ 创建用户 ${username}`);
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        isActive: true,
        mustChangePassword: false,
        ...(opts.email ? { email: opts.email } : {}),
        ...(opts.phone ? { phone: opts.phone } : {}),
      },
    });
    console.log(`✅ 更新用户 ${username}（密码 → ${PASSWORD}）`);
  }

  for (const r of opts.removeRoles ?? []) {
    await removeRole(user.id, r);
  }
  await ensureRole(user.id, opts.role);

  const roles = await prisma.userRole.findMany({
    where: { userId: user.id },
    include: { role: true },
  });
  console.log(`   角色: ${roles.map((r) => r.role.code).join(", ")}`);
}

async function main() {
  console.log("=== 内部账号设置 ===\n");

  await setupUser("admin", {
    role: "ADMIN",
    email: "admin@system.local",
    phone: "0000000000",
    removeRoles: ["RECIPIENT", "TEACHER"],
  });

  await setupUser("Warren", {
    role: "RECIPIENT",
    email: "warrenwong0308@gmail.com",
    phone: "0000000001",
    removeRoles: ["TEACHER", "ADMIN"],
  });

  console.log("\n=== 当前所有用户 ===\n");
  const users = await prisma.user.findMany({
    include: { roles: { include: { role: true } } },
    orderBy: { username: "asc" },
  });
  for (const u of users) {
    console.log(
      `  ${u.username.padEnd(12)} ${u.isActive ? "启用" : "停用"}  ${u.roles.map((r) => r.role.code).join(", ") || "-"}`
    );
  }

  console.log("\n登录: http://localhost:3000/login");
  console.log("  admin  / 000000  → 全部权限");
  console.log("  Warren / 000000  → 收费员（RECIPIENT）\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
