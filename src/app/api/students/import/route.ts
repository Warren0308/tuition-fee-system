import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

/**
 * 批量导入学生 (CSV)
 * 
 * CSV 列（首行为表头，必填列标 *）：
 *   fullName*       学生姓名
 *   gender          M / F / male / female / 男 / 女
 *   dateOfBirth     YYYY-MM-DD
 *   gradeName*      年级名（需在字典中存在）
 *   schoolName      学校名（自动按名匹配，不存在跳过该列）
 *   className       班级
 *   address         地址
 *   guardianName    监护人姓名
 *   guardianPhone   监护人电话
 *   guardianRelation 监护人关系（如 父亲、母亲）
 *
 * Body: { csvText: string, dryRun: boolean }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { csvText, dryRun } = await req.json();
    if (!csvText || typeof csvText !== "string") {
      return NextResponse.json({ error: "缺少 CSV 内容" }, { status: 400 });
    }

    const rows = parseCSV(csvText);
    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV 为空" }, { status: 400 });
    }

    const headerRow = rows[0].map((h) => h.trim());
    const dataRows = rows.slice(1);

    const colIdx = (name: string) => headerRow.findIndex((h) => h === name);
    const requiredCols = ["fullName", "gradeName"];
    for (const c of requiredCols) {
      if (colIdx(c) < 0) {
        return NextResponse.json(
          { error: `缺少必需列: ${c}` },
          { status: 400 }
        );
      }
    }

    // 预加载字典
    const [grades, schools, guardianTypes] = await Promise.all([
      prisma.grade.findMany(),
      prisma.school.findMany(),
      prisma.guardianType.findMany(),
    ]);
    const gradeByName = new Map(grades.map((g) => [g.name.trim(), g]));
    const schoolByName = new Map(schools.map((s) => [s.name.trim(), s]));
    const guardianByName = new Map(guardianTypes.map((g) => [g.name.trim(), g]));

    const results = {
      total: dataRows.length,
      created: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; line: string; error: string }>,
      students: [] as Array<{ id: string; name: string }>,
    };

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // 表头是第 1 行
      const lineText = row.join(",");

      try {
        const get = (name: string) => {
          const idx = colIdx(name);
          if (idx < 0 || idx >= row.length) return "";
          return (row[idx] || "").trim();
        };

        const fullName = get("fullName");
        const gradeName = get("gradeName");

        if (!fullName) {
          results.skipped++;
          results.errors.push({ row: rowNum, line: lineText, error: "学生姓名为空" });
          continue;
        }
        if (!gradeName) {
          results.skipped++;
          results.errors.push({ row: rowNum, line: lineText, error: "年级为空" });
          continue;
        }

        const grade = gradeByName.get(gradeName);
        if (!grade) {
          results.skipped++;
          results.errors.push({
            row: rowNum,
            line: lineText,
            error: `年级 "${gradeName}" 在字典中不存在，请先添加`,
          });
          continue;
        }

        // gender
        const genderRaw = get("gender").toUpperCase();
        let gender: "MALE" | "FEMALE" | undefined;
        if (["M", "MALE", "男"].includes(genderRaw)) gender = "MALE";
        else if (["F", "FEMALE", "女"].includes(genderRaw)) gender = "FEMALE";

        // 出生日期
        let dateOfBirth: Date | undefined;
        const dobRaw = get("dateOfBirth");
        if (dobRaw) {
          const d = new Date(dobRaw);
          if (!isNaN(d.getTime())) dateOfBirth = d;
        }

        // school
        let schoolId: number | undefined;
        const schoolName = get("schoolName");
        if (schoolName) {
          const school = schoolByName.get(schoolName);
          if (school) schoolId = school.id;
        }

        const className = get("className") || undefined;
        const address = get("address") || undefined;

        // dry-run: 只检查不写入
        if (dryRun) {
          results.created++;
          continue;
        }

        // 创建学生
        const student = await prisma.student.create({
          data: {
            fullName,
            gradeId: grade.id,
            schoolId,
            className: className ?? null,
            address: address ?? null,
            gender,
            dateOfBirth,
            isActive: true,
          },
        });

        // 监护人
        const gName = get("guardianName");
        const gPhone = get("guardianPhone");
        const gRelation = get("guardianRelation");
        if (gName && gPhone) {
          let relationTypeId: number | undefined;
          if (gRelation) {
            const rel = guardianByName.get(gRelation);
            if (rel) relationTypeId = rel.id;
          }

          // relationTypeId 必填 — 找一个默认值
          if (relationTypeId === undefined) {
            relationTypeId = guardianTypes[0]?.id;
          }
          if (relationTypeId === undefined) {
            // 字典里完全没有任何监护人关系类型时跳过监护人创建
            results.errors.push({
              row: rowNum,
              line: lineText,
              error: "无法创建监护人：监护人关系字典为空",
            });
          } else {
            await prisma.studentGuardian.create({
              data: {
                studentId: student.id,
                name: gName,
                phone: gPhone,
                relationTypeId,
                isPrimary: true,
              },
            });
          }
        }

        results.created++;
        results.students.push({ id: student.id, name: fullName });
      } catch (e: any) {
        results.skipped++;
        results.errors.push({
          row: rowNum,
          line: lineText,
          error: e.message || "未知错误",
        });
      }
    }

    return NextResponse.json({ dryRun: !!dryRun, ...results });
  } catch (error: any) {
    console.error("批量导入失败:", error);
    return NextResponse.json(
      { error: error.message || "导入失败" },
      { status: 500 }
    );
  }
}

/** 简单 CSV 解析（支持引号转义） */
function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const result: string[][] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const row: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === ",") {
          row.push(cur);
          cur = "";
        } else if (ch === '"') {
          inQuote = true;
        } else {
          cur += ch;
        }
      }
    }
    row.push(cur);
    result.push(row);
  }
  return result;
}
