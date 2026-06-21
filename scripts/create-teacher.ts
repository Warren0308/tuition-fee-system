/**
 * 创建老师账号
 *
 * 用法：
 *   npx tsx scripts/create-teacher.ts <username> <password>
 *
 * 示例：
 *   npx tsx scripts/create-teacher.ts test1 1234
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const prisma = new PrismaClient();

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!process.env.DATABASE_URL) {
    console.error("❌ 未找到 DATABASE_URL，请先配置 .env 文件");
    process.exit(1);
  }

  if (!username || !password) {
    console.error("用法: npx tsx scripts/create-teacher.ts <username> <password>");
    process.exit(1);
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    console.error("❌ 用户名只能包含字母、数字和下划线");
    process.exit(1);
  }

  if (password.length < 4) {
    console.error("❌ 密码至少 4 位");
    process.exit(1);
  }

  const role = await prisma.role.findUnique({ where: { code: "TEACHER" } });
  if (!role) {
    console.error("❌ TEACHER 角色不存在，请先运行 npm run seed");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.error(`❌ 用户名 "${username}" 已存在`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        passwordHash,
        isActive: true,
        mustChangePassword: false,
        roles: { create: [{ roleId: role.id }] },
      },
    });

    await tx.teacher.create({
      data: {
        userId: user.id,
        name: username,
      },
    });
  });

  console.log("\n✅ 老师账号创建成功！\n");
  console.log(`  用户名: ${username}`);
  console.log(`  密码:   ${password}`);
  console.log(`  角色:   TEACHER（老师）`);
  console.log(`  状态:   已启用\n`);
}

main()
  .catch((e) => {
    console.error("❌ 创建失败:", e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
