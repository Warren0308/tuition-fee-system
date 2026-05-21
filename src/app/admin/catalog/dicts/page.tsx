import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { DictItemRow } from "./components/DictItemRow";

async function getData() {
  const [grades, schools, guardians] = await Promise.all([
    prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    prisma.guardianType.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { grades, schools, guardians };
}

export default async function DictsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以访问字典管理</p>
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
  
  const { grades, schools, guardians } = await getData();
  
  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* 页面标题 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📚 字典管理</h1>
            <p className="text-gray-600">管理年级、学校和监护人关系类型</p>
          </div>
          <Link 
            href="/admin/catalog" 
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          >
            ← 返回分类管理
          </Link>
        </div>
      </div>

      {/* 课程字典链接 */}
      <div className="animate-fade-in">
        <Link
          href="/admin/catalog/dicts/courses"
          className="card-modern group block hover:shadow-lg transition-all duration-300"
        >
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-300">
                📚
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800 group-hover:text-purple-600 transition-colors duration-300">课程字典管理</h2>
                <p className="text-gray-600 text-sm">管理课程类型和课程</p>
              </div>
            </div>
            <div className="text-gray-400 group-hover:text-purple-600 transition-colors duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      </div>

      {/* 字典管理卡片 */}
      <div className="grid lg:grid-cols-3 gap-6 animate-fade-in">
        {/* 年级管理 */}
        <div className="card-modern">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                🎓
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">年级管理</h2>
                <p className="text-gray-600 text-sm">管理学生年级分类</p>
              </div>
            </div>

            {/* 添加年级表单 */}
            <form action="/api/admin/dicts/grade" method="post" className="space-y-3 mb-6">
              <div className="grid grid-cols-3 gap-2">
                <input 
                  name="name" 
                  placeholder="年级名称" 
                  className="input-modern col-span-2 text-sm px-3 py-2" 
                  required
                />
                <input 
                  name="orderIndex" 
                  placeholder="排序" 
                  type="number"
                  className="input-modern text-sm px-3 py-2" 
                  required
                />
              </div>
              <button className="btn-modern w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-sm font-medium transition-colors">
                ➕ 添加年级
              </button>
            </form>

            {/* 年级列表 */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {grades.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-2xl mb-2">📝</div>
                  <p className="text-sm">暂无年级数据</p>
                </div>
              ) : (
                grades.map(grade => (
                  <DictItemRow
                    key={grade.id}
                    type="grade"
                    id={grade.id}
                    name={grade.name}
                    orderIndex={grade.orderIndex}
                    accentColor="blue"
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* 学校管理 */}
        <div className="card-modern">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
                🏫
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">学校管理</h2>
                <p className="text-gray-600 text-sm">管理学生所属学校</p>
              </div>
            </div>

            {/* 添加学校表单 */}
            <form action="/api/admin/dicts/school" method="post" className="space-y-3 mb-6">
              <input 
                name="name" 
                placeholder="学校名称" 
                className="input-modern w-full text-sm px-3 py-2.5" 
                required
              />
              <button className="btn-modern w-full bg-green-600 hover:bg-green-700 text-white py-2.5 text-sm font-medium transition-colors">
                ➕ 添加学校
              </button>
            </form>

            {/* 学校列表 */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {schools.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-2xl mb-2">🏫</div>
                  <p className="text-sm">暂无学校数据</p>
                </div>
              ) : (
                schools.map(school => (
                  <DictItemRow
                    key={school.id}
                    type="school"
                    id={school.id}
                    name={school.name}
                    accentColor="green"
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* 监护人关系管理 */}
        <div className="card-modern">
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">
                👥
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">监护人关系</h2>
                <p className="text-gray-600 text-sm">管理监护人关系类型</p>
              </div>
            </div>

            {/* 添加监护人关系表单 */}
            <form action="/api/admin/dicts/guardian" method="post" className="space-y-3 mb-6">
              <input 
                name="name" 
                placeholder="关系名称" 
                className="input-modern w-full text-sm px-3 py-2.5" 
                required
              />
              <button className="btn-modern w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 text-sm font-medium transition-colors">
                ➕ 添加关系
              </button>
            </form>

            {/* 监护人关系列表 */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {guardians.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-2xl mb-2">👥</div>
                  <p className="text-sm">暂无关系数据</p>
                </div>
              ) : (
                guardians.map(guardian => (
                  <DictItemRow
                    key={guardian.id}
                    type="guardian"
                    id={guardian.id}
                    name={guardian.name}
                    accentColor="orange"
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up">
        <div className="card-modern p-4 border-l-4 border-blue-500">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
              🎓
            </div>
            <div>
              <p className="text-sm text-gray-600">年级总数</p>
              <p className="text-2xl font-bold text-blue-600">{grades.length}</p>
            </div>
          </div>
        </div>
        
        <div className="card-modern p-4 border-l-4 border-green-500">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
              🏫
            </div>
            <div>
              <p className="text-sm text-gray-600">学校总数</p>
              <p className="text-2xl font-bold text-green-600">{schools.length}</p>
            </div>
          </div>
        </div>

        <div className="card-modern p-4 border-l-4 border-orange-500">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
              👥
            </div>
            <div>
              <p className="text-sm text-gray-600">关系类型</p>
              <p className="text-2xl font-bold text-orange-600">{guardians.length}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


