/** 中学细分科目（补习班子标签 + 费用目录） */

export const SECONDARY_SUBJECT_COURSES = [
  { code: "SEC_BM", name: "中学国文", group: "SEC_MALAY", dictNames: ["中学国文", "国文"] },
  { code: "SEC_EN", name: "中学英文", group: "SEC_ENGLISH", dictNames: ["中学英文", "英文"] },
  { code: "SEC_MATH", name: "中学数学", group: "SEC_MATH", dictNames: ["中学数学"] },
  { code: "SEC_HIST", name: "中学历史", group: "SEC_HISTORY", dictNames: ["中学历史"] },
  {
    code: "SEC_EN_WRITING",
    name: "中学英文作文",
    group: "SEC_EN_WRITING",
    dictNames: ["中学英文作文"],
  },
] as const;

export const SECONDARY_SUBJECT_CODES = SECONDARY_SUBJECT_COURSES.map((c) => c.code);

export const COURSE_GROUP_LABELS: Record<string, string> = {
  HOMEWORK: "功课班",
  TUITION: "补习班",
  WRITING: "写作班",
  SEC_ENGLISH: "中学英文",
  SEC_MALAY: "中学国文",
  SEC_MATH: "中学数学",
  SEC_HISTORY: "中学历史",
  SEC_EN_WRITING: "中学英文作文",
};

export const COURSE_GROUP_COLORS: Record<string, string> = {
  HOMEWORK: "bg-blue-100 text-blue-800 border-blue-200",
  TUITION: "bg-green-100 text-green-800 border-green-200",
  WRITING: "bg-purple-100 text-purple-800 border-purple-200",
  SEC_ENGLISH: "bg-orange-100 text-orange-800 border-orange-200",
  SEC_MALAY: "bg-pink-100 text-pink-800 border-pink-200",
  SEC_MATH: "bg-teal-100 text-teal-800 border-teal-200",
  SEC_HISTORY: "bg-amber-100 text-amber-800 border-amber-200",
  SEC_EN_WRITING: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

/** 费用目录：中学课程 dict 名称 → CourseGroup */
export function resolveSecondaryCourseGroup(dictName: string, typeName: string): string {
  if (typeName !== "中学课程") return "TUITION";
  for (const c of SECONDARY_SUBJECT_COURSES) {
    if ((c.dictNames as readonly string[]).includes(dictName)) return c.group;
  }
  return "SEC_ENGLISH";
}
