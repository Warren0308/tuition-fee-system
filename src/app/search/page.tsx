import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getOptions() {
  try {
    const [grades, schools, courses] = await Promise.all([
      prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }).catch(() => []),
      prisma.school.findMany({ orderBy: { name: "asc" } }).catch(() => []),
      prisma.course.findMany({ orderBy: { name: "asc" } }).catch(() => []),
    ]);
    return { grades, schools, courses };
  } catch (error) {
    console.error('getOptions error:', error);
    return { grades: [], schools: [], courses: [] };
  }
}

function parseArrayParam(param: string | string[] | undefined) {
  if (!param) return [] as number[];
  const arr = Array.isArray(param) ? param : [param];
  return arr.map(v => Number(v)).filter(Boolean);
}

async function searchStudents(gradeIds: number[], schoolIds: number[], courseIds: number[]) {
  try {
    const whereConditions: any = {};
    
    if (gradeIds.length > 0) {
      whereConditions.gradeId = { in: gradeIds };
    }
    
    if (schoolIds.length > 0) {
      whereConditions.schoolId = { in: schoolIds };
    }
    
    if (courseIds.length > 0) {
      whereConditions.enrollments = { 
        some: { 
          courseId: { in: courseIds }, 
          endTermId: null 
        } 
      };
    }

    return await prisma.student.findMany({
      where: whereConditions,
      include: { 
        grade: true, 
        school: true, 
        enrollments: { 
          where: { endTermId: null }, 
          include: { course: true } 
        } 
      },
      take: 200,
    });
  } catch (error) {
    console.error('searchStudents error:', error);
    return [];
  }
}

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以使用智能查询功能</p>
          <Link 
            className="btn-modern bg-gradient-primary text-white px-6 py-3 inline-flex items-center space-x-2" 
            href="/login"
          >
            <span>🚀</span>
            <span>立即登录</span>
          </Link>
        </div>
      </div>
    );
  }
  
  let grades: any[] = [], schools: any[] = [], courses: any[] = [], results: any[] = [];
  
  try {
    const options = await getOptions();
    grades = options.grades;
    schools = options.schools;
    courses = options.courses;

    const selectedGrades = parseArrayParam(searchParams["gradeId"]);
    const selectedSchools = parseArrayParam(searchParams["schoolId"]);
    const selectedCourses = parseArrayParam(searchParams["courseId"]);
    
    if (selectedGrades.length || selectedSchools.length || selectedCourses.length) {
      results = await searchStudents(selectedGrades, selectedSchools, selectedCourses);
    }
  } catch (error) {
    console.error('Search page error:', error);
  }

  const selectedGrades = parseArrayParam(searchParams["gradeId"]);
  const selectedSchools = parseArrayParam(searchParams["schoolId"]);
  const selectedCourses = parseArrayParam(searchParams["courseId"]);
  const hasSearch = selectedGrades.length > 0 || selectedSchools.length > 0 || selectedCourses.length > 0;

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* 页面标题 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">🔍 智能查询</h1>
            <p className="text-gray-600">多条件筛选查找学生信息</p>
          </div>
          <Link 
            href="/students" 
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          >
            👥 学生管理
          </Link>
        </div>
      </div>

      {/* 查询表单 */}
      <div className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
              🎯
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">筛选条件</h2>
              <p className="text-gray-600 text-sm">选择一个或多个条件进行查询</p>
            </div>
          </div>

          <form method="get" className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              {/* 年级筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📚 年级筛选 ({selectedGrades.length > 0 ? `已选${selectedGrades.length}个` : '未选择'})
                </label>
                <div className="card-modern p-4 max-h-48 overflow-auto">
                  <div className="space-y-2">
                    {grades.map(g => (
                      <label key={g.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          name="gradeId" 
                          value={g.id} 
                          defaultChecked={selectedGrades.includes(g.id)} 
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{g.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 学校筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  🏫 学校筛选 ({selectedSchools.length > 0 ? `已选${selectedSchools.length}个` : '未选择'})
                </label>
                <div className="card-modern p-4 max-h-48 overflow-auto">
                  <div className="space-y-2">
                    {schools.map(s => (
                      <label key={s.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          name="schoolId" 
                          value={s.id} 
                          defaultChecked={selectedSchools.includes(s.id)} 
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 课程筛选 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  📖 课程筛选 ({selectedCourses.length > 0 ? `已选${selectedCourses.length}个` : '未选择'})
                </label>
                <div className="card-modern p-4 max-h-48 overflow-auto">
                  <div className="space-y-2">
                    {courses.map(c => (
                      <label key={c.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          name="courseId" 
                          value={c.id} 
                          defaultChecked={selectedCourses.includes(c.id)} 
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{c.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {hasSearch ? (
                  <span>已设置 {selectedGrades.length + selectedSchools.length + selectedCourses.length} 个筛选条件</span>
                ) : (
                  <span>请选择筛选条件后点击查询</span>
                )}
              </div>
              <div className="flex space-x-3">
                <Link 
                  href="/search"
                  className="btn-modern bg-gray-100 text-gray-600 px-4 py-2 hover:bg-gray-200 inline-flex items-center space-x-2"
                >
                  <span>🗑️</span>
                  <span>清空条件</span>
                </Link>
                <button 
                  type="submit"
                  className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 font-medium"
                >
                  🔍 开始查询
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* 查询结果 */}
      {hasSearch && (
        <div className="card-modern animate-fade-in">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">查询结果</h3>
                <p className="text-gray-600 text-sm">
                  找到 <span className="font-medium text-blue-600">{results.length}</span> 个匹配的学生
                </p>
              </div>
              {results.length > 0 && (
                <div className="text-sm text-gray-500">
                  限制显示前200条结果
                </div>
              )}
            </div>

            {results.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">学生姓名</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">班级年级</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">学校</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">在读课程</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((student, index) => (
                      <tr key={student.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                              {student.fullName.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-800">{student.fullName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div>
                            <div className="font-medium">{student.className || '未设置'}</div>
                            <div className="text-blue-600">{student.grade?.name}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {student.school?.name || '未设置'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {student.enrollments.map((enrollment: any) => (
                              <span 
                                key={enrollment.id} 
                                className="inline-flex px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full"
                              >
                                {enrollment.course.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Link 
                            href={`/students/${student.id}`}
                            className="btn-modern bg-blue-100 text-blue-600 px-3 py-1 text-sm hover:bg-blue-200 transition-colors"
                          >
                            📄 查看详情
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-medium text-gray-800 mb-2">未找到匹配的学生</h3>
                <p className="text-gray-600">请尝试调整筛选条件或检查数据</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!hasSearch && (
        <div className="card-modern animate-fade-in">
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-medium text-gray-800 mb-2">智能查询系统</h3>
            <p className="text-gray-600 mb-6">请选择上方的筛选条件，然后点击查询按钮开始搜索</p>
            <div className="text-sm text-gray-500">
              💡 提示：可以同时选择多个条件进行精确查询
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


