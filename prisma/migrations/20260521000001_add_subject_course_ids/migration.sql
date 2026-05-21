-- 给 StudentEnrollment 添加子科目标签字段 (用于补习班的华文/国文/英文/数学/科学等)
-- 默认空数组 = 暂时没分细科目
ALTER TABLE "StudentEnrollment" ADD COLUMN "subjectCourseIds" INTEGER[] NOT NULL DEFAULT '{}';
