-- 创建课程类型表
CREATE TABLE "public"."CourseType" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseType_pkey" PRIMARY KEY ("id")
);

-- 创建课程字典表
CREATE TABLE "public"."CourseDict" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "typeId" INTEGER NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseDict_pkey" PRIMARY KEY ("id")
);

-- 添加外键约束
ALTER TABLE "public"."CourseDict" ADD CONSTRAINT "CourseDict_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "public"."CourseType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 添加唯一约束
CREATE UNIQUE INDEX "CourseType_name_key" ON "public"."CourseType"("name");
CREATE UNIQUE INDEX "CourseDict_name_key" ON "public"."CourseDict"("name");







