-- DropIndex
DROP INDEX "CourseDict_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "CourseDict_name_typeId_key" ON "CourseDict"("name", "typeId");







