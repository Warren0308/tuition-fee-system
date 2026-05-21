/**
 * 密码重置工具
 *
 * 用法：
 *   npx tsx scripts/reset-password.ts <username> <newPassword>
 *
 * 示例：
 *   npx tsx scripts/reset-password.ts admin admin123
 *
 * 不带参数时会列出所有用户。
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function listUsers() {
  const users = await prisma.user.findMany({
    select: {
      username: true,
      email: true,
      isActive: true,
      mustChangePassword: true,
      roles: { include: { role: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\n=== 系统中所有用户 ===\n");
  console.table(
    users.map((u) => ({
      用户名: u.username,
      邮箱: u.email || "-",
      角色: u.roles.map((r) => r.role.code).join(", ") || "-",
      已启用: u.isActive ? "是" : "否",
      需改密: u.mustChangePassword ? "是" : "否",
    }))
  );

  console.log("\n使用方式：");
  console.log("  npx tsx scripts/reset-password.ts <用户名> <新密码>");
  console.log("\n示例：");
  console.log("  npx tsx scripts/reset-password.ts admin admin123\n");
}

async function resetPassword(username: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { roles: { include: { role: true } } },
  });

  if (!user) {
    console.error(`❌ 用户 "${username}" 不存在`);
    console.log("\n提示：运行不带参数的命令可查看所有用户：");
    console.log("  npx tsx scripts/reset-password.ts");
    process.exit(1);
  }

  if (newPassword.length < 4) {
    console.error("❌ 密码至少 4 位");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { username },
    data: {
      passwordHash,
      mustChangePassword: false, // 重置后无需再强制改密
      isActive: true, // 顺便启用账户
    },
  });

  console.log("\n✅ 密码已重置成功！\n");
  console.log("  用户名: " + username);
  console.log("  新密码: " + newPassword);
  console.log("  角色: " + user!.roles.map((r: any) => r.role.code).join(", "));
  console.log("\n请尽快登录后修改为更安全的密码：");
  console.log("  http://localhost:3001/login\n");
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    await listUsers();
    return;
  }

  if (args.length !== 2) {
    console.error("❌ 参数错误");
    console.log("\n用法: npx tsx scripts/reset-password.ts <用户名> <新密码>");
    process.exit(1);
  }

  await resetPassword(args[0], args[1]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
