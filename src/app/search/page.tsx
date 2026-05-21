import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getOptions() {
  const [grades, schools, courses] = await Promise.all([
    prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    prisma.course.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { grades, schools, courses };
}

function parseArrayParam(param: string | string[] | undefined) {
  if (!param) return [] as number[];
  const arr = Array.isArray(param) ? param : [param];
  return arr.map(v => Number(v)).filter(Boolean);
}

async function searchStudents(gradeIds: number[], schoolIds: number[], courseIds: number[]) {
  return prisma.student.findMany({
    where: {
      AND: [
        gradeIds.length ? { gradeId: { in: gradeIds } } : {},
        schoolIds.length ? { schoolId: { in: schoolIds } } : {},
        courseIds.length ? { enrollments: { some: { courseId: { in: courseIds }, endTermId: null } } } : {},
      ],
    },
    include: { grade: true, school: true, enrollments: { where: { endTermId: null }, include: { course: true } } },
    take: 200,
  });
}

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const { grades, schools, courses } = await getOptions();
  const selectedGrades = parseArrayParam(searchParams["gradeId"]);
  const selectedSchools = parseArrayParam(searchParams["schoolId"]);
  const selectedCourses = parseArrayParam(searchParams["courseId"]);
  const results = (selectedGrades.length || selectedSchools.length || selectedCourses.length)
    ? await searchStudents(selectedGrades, selectedSchools, selectedCourses)
    : [];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">查询学生/班级</h1>
      <form method="get" className="grid md:grid-cols-3 gap-4">
        <div>
          <div className="font-medium mb-1">班级（年级）</div>
          <div className="space-y-1 max-h-48 overflow-auto border p-2 rounded">
            {grades.map(g => (
              <label key={g.id} className="block text-sm">
                <input type="checkbox" name="gradeId" value={g.id} defaultChecked={selectedGrades.includes(g.id)} className="mr-2" />{g.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="font-medium mb-1">学校</div>
          <div className="space-y-1 max-h-48 overflow-auto border p-2 rounded">
            {schools.map(s => (
              <label key={s.id} className="block text-sm">
                <input type="checkbox" name="schoolId" value={s.id} defaultChecked={selectedSchools.includes(s.id)} className="mr-2" />{s.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="font-medium mb-1">课程</div>
          <div className="space-y-1 max-h-48 overflow-auto border p-2 rounded">
            {courses.map(c => (
              <label key={c.id} className="block text-sm">
                <input type="checkbox" name="courseId" value={c.id} defaultChecked={selectedCourses.includes(c.id)} className="mr-2" />{c.name}
              </label>
            ))}
          </div>
        </div>
        <div className="md:col-span-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded">查询</button>
        </div>
      </form>
      {results.length > 0 && (
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">学生</th>
              <th className="p-2 border">班级</th>
              <th className="p-2 border">学校</th>
              <th className="p-2 border">课程</th>
            </tr>
          </thead>
          <tbody>
            {results.map(s => (
              <tr key={s.id}>
                <td className="p-2 border"><Link className="text-blue-600" href={`/students/${s.id}`}>{s.fullName}</Link></td>
                <td className="p-2 border">{s.className ?? "-"}（{s.grade?.name}）</td>
                <td className="p-2 border">{s.school?.name ?? "-"}</td>
                <td className="p-2 border">{s.enrollments.map(e => e.course.name).join("、")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}


