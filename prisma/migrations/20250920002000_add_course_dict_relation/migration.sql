-- AlterTable
ALTER TABLE "Course" ADD COLUMN "dictId" INTEGER;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_dictId_fkey" FOREIGN KEY ("dictId") REFERENCES "CourseDict"("id") ON DELETE SET NULL ON UPDATE CASCADE;







