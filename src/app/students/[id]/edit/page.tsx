import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getData(studentId: string) {
  const [student, grades, schools] = await Promise.all([
    prisma.student.findUnique({
      where: { id: studentId },
      include: { grade: true, school: true },
    }),
    prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.school.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!student) return null;
  return { student, grades, schools };
}

export default async function EditStudentPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">需要登录</h2>
          <Link className="text-blue-600 hover:underline" href="/login">立即登录</Link>
        </div>
      </div>
    );
  }

  const data = await getData(params.id);
  if (!data) return notFound();
  const { student, grades, schools } = data;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">✏️</span>
            编辑学生资料
          </h1>
          <p className="text-gray-600 mt-1">{student.fullName}</p>
        </div>
        <Link
          href={`/students/${student.id}`}
          className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
        >
          ← 返回学生详情
        </Link>
      </div>

      <div className="card-modern p-6">
        <form
          action={`/api/students/${student.id}`}
          method="post"
          className="space-y-6"
        >
          <input type="hidden" name="_method" value="PATCH" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                name="fullName"
                defaultValue={student.fullName}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年级 <span className="text-red-500">*</span>
              </label>
              <select
                name="gradeId"
                defaultValue={student.gradeId}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {grades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学校</label>
              <select
                name="schoolId"
                defaultValue={student.schoolId || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">未指定</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">班级</label>
              <input
                name="className"
                defaultValue={student.className || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="如: 五年甲班"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">性别</label>
              <select
                name="gender"
                defaultValue={student.gender || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">未指定</option>
                <option value="MALE">男</option>
                <option value="FEMALE">女</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出生日期</label>
              <input
                type="date"
                name="dateOfBirth"
                defaultValue={
                  student.dateOfBirth
                    ? student.dateOfBirth.toISOString().split('T')[0]
                    : ''
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">住址</label>
              <input
                name="address"
                defaultValue={student.address || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                住址（补充）
              </label>
              <input
                name="address2"
                defaultValue={student.address2 || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="楼栋/单元号等"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">城市</label>
              <input
                name="city"
                defaultValue={student.city || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">州/省</label>
              <input
                name="state"
                defaultValue={student.state || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮编</label>
              <input
                name="postcode"
                defaultValue={student.postcode || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <Link
              href={`/students/${student.id}`}
              className="btn-modern bg-gray-200 text-gray-700 px-6 py-2 hover:bg-gray-300"
            >
              取消
            </Link>
            <button
              type="submit"
              className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 font-medium"
            >
              💾 保存修改
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
