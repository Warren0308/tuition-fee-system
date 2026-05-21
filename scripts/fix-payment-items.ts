/**
 * 修复历史导入时残留的:
 *   - 错误的 refId (指向已合并/删除的课程)
 *   - 简化的 description (补习 → 补习班, 国中 → 中学国文, 英文 → 中学英文)
 */
import * as fs from "fs";
import * as path from "path";
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const isCommit = process.argv.includes("--commit");

// description → 正确的 (refId, name)
const FIX_MAP: Record<string, { refId: number; name: string; type: "COURSE" | "EXTRA_FEE" }> = {
  功课班: { refId: 1, name: "功课班", type: "COURSE" },
  补习: { refId: 13, name: "补习班", type: "COURSE" }, // 补习班 留在 id=13
  写作: { refId: 7, name: "写作", type: "COURSE" },
  国中: { refId: 9, name: "中学国文", type: "COURSE" },
  英文: { refId: 8, name: "中学英文", type: "COURSE" },
  交通: { refId: 2, name: "交通", type: "EXTRA_FEE" },
  膳食: { refId: 1, name: "膳食", type: "EXTRA_FEE" },
};

async function main() {
  console.log(`==== ${isCommit ? "🚨 真正修复" : "🔍 Dry-Run"} ====\n`);

  // 取所有 import 导入的 items
  const items = await prisma.studentTermPaymentItem.findMany({
    where: {
      OR: [
        { description: { in: Object.keys(FIX_MAP) } },
      ],
    },
  });

  console.log(`找到 ${items.length} 条需要检查的付款明细\n`);

  let fixedRefId = 0;
  let fixedDescription = 0;
  let unchanged = 0;

  for (const it of items) {
    const target = FIX_MAP[it.description];
    if (!target) continue;
    if (target.type !== it.itemType) {
      console.log(`   ⚠️ 类型不一致 id=${it.id}: db=${it.itemType} vs target=${target.type}，跳过`);
      continue;
    }
    const needRefIdFix = it.refId !== target.refId;
    const needNameFix = it.description !== target.name;
    if (!needRefIdFix && !needNameFix) {
      unchanged++;
      continue;
    }
    if (needRefIdFix) fixedRefId++;
    if (needNameFix) fixedDescription++;
    if (isCommit) {
      await prisma.studentTermPaymentItem.update({
        where: { id: it.id },
        data: { refId: target.refId, description: target.name },
      });
    }
  }

  console.log(`refId 需要修正：${fixedRefId} 条`);
  console.log(`description 需要修正：${fixedDescription} 条`);
  console.log(`已经正确无需修改：${unchanged} 条`);

  if (!isCommit) {
    console.log(`\n确认请加 --commit 重新执行`);
  } else {
    console.log(`\n✅ 修复完成`);
  }
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
