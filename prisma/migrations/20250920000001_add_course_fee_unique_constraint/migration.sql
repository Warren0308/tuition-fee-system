-- 添加唯一约束，确保同一个年级的同一个课程不能有重复的费用记录
ALTER TABLE "public"."CourseFee" ADD CONSTRAINT "CourseFee_courseId_gradeId_unique" UNIQUE ("courseId", "gradeId");







