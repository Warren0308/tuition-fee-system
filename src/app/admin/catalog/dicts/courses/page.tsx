import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { CourseManager } from "./components/CourseManager";

async function getData() {
  const [types, courses] = await Promise.all([
    prisma.courseType.findMany({
      orderBy: { orderIndex: "asc" }
    }),
    prisma.courseDict.findMany({
      include: { type: true },
      orderBy: [
        { type: { orderIndex: "asc" } },
        { orderIndex: "asc" }
      ]
    })
  ]);

  return { types, courses };
}

export default async function CourseDictPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以访问课程字典管理</p>
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

  const { types, courses } = await getData();

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* 页面标题 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📚 课程字典管理</h1>
            <p className="text-gray-600">管理课程类型和课程</p>
          </div>
          <Link 
            href="/admin/catalog/dicts" 
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          >
            ← 返回字典管理
          </Link>
        </div>
      </div>

      {/* 课程管理器 */}
      <div className="animate-fade-in">
        <CourseManager types={types} courses={courses} />
      </div>
    </div>
  );
}







