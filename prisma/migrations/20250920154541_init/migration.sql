-- DropIndex
DROP INDEX "public"."StudentEnrollment_studentId_courseId_idx";

-- CreateTable
CREATE TABLE "public"."CourseSchedule" (
    "id" TEXT NOT NULL,
    "termId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "CourseSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseSchedule_termId_idx" ON "public"."CourseSchedule"("termId");

-- CreateIndex
CREATE INDEX "CourseSchedule_courseId_idx" ON "public"."CourseSchedule"("courseId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_studentId_idx" ON "public"."StudentEnrollment"("studentId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_courseId_idx" ON "public"."StudentEnrollment"("courseId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_startTermId_idx" ON "public"."StudentEnrollment"("startTermId");

-- CreateIndex
CREATE INDEX "StudentEnrollment_endTermId_idx" ON "public"."StudentEnrollment"("endTermId");

-- CreateIndex
CREATE INDEX "StudentTermPayment_year_termIndex_idx" ON "public"."StudentTermPayment"("year", "termIndex");

-- AddForeignKey
ALTER TABLE "public"."StudentTermPayment" ADD CONSTRAINT "StudentTermPayment_year_termIndex_fkey" FOREIGN KEY ("year", "termIndex") REFERENCES "public"."Term"("year", "termIndex") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseSchedule" ADD CONSTRAINT "CourseSchedule_termId_fkey" FOREIGN KEY ("termId") REFERENCES "public"."Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CourseSchedule" ADD CONSTRAINT "CourseSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "public"."CourseFee_courseId_gradeId_unique" RENAME TO "CourseFee_courseId_gradeId_key";
