import { prisma } from "@/lib/prisma";

export async function isTermForceClosed(
  studentId: string,
  year: number,
  termIndex: number
): Promise<boolean> {
  const row = await prisma.studentTermForceClose.findUnique({
    where: {
      studentId_year_termIndex: { studentId, year, termIndex },
    },
  });
  return row != null;
}

export async function isTermForceClosedByTermId(
  studentId: string,
  termId: number
): Promise<boolean> {
  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (!term) return false;
  return isTermForceClosed(studentId, term.year, term.termIndex);
}

export async function getForceClosedTermKeys(
  studentId: string
): Promise<Set<string>> {
  const rows = await prisma.studentTermForceClose.findMany({
    where: { studentId },
    select: { year: true, termIndex: true },
  });
  return new Set(rows.map((r) => `${r.year}_${r.termIndex}`));
}

export async function forceCloseTerm(
  studentId: string,
  year: number,
  termIndex: number,
  note?: string
) {
  await prisma.studentTermForceClose.upsert({
    where: {
      studentId_year_termIndex: { studentId, year, termIndex },
    },
    update: { note: note ?? null },
    create: { studentId, year, termIndex, note: note ?? null },
  });

  await prisma.studentChangeLog.create({
    data: {
      studentId,
      action: "TERM_FORCE_CLOSE",
      after: { year, termIndex, note: note ?? null },
    },
  });
}

export async function undoForceCloseTerm(
  studentId: string,
  year: number,
  termIndex: number
) {
  await prisma.studentTermForceClose.deleteMany({
    where: { studentId, year, termIndex },
  });

  await prisma.studentChangeLog.create({
    data: {
      studentId,
      action: "TERM_FORCE_CLOSE_UNDO",
      before: { year, termIndex },
    },
  });
}

export function termCoordKey(year: number, termIndex: number) {
  return `${year}_${termIndex}`;
}
