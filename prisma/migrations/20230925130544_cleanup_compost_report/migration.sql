/*
  Warnings:

  - The required column `compostReportId` was added to the `CompostReport` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX "CompostReport_compostStandId_key";

-- AlterTable
ALTER TABLE "CompostReport" ADD COLUMN     "compostReportId" TEXT NOT NULL,
ADD CONSTRAINT "CompostReport_pkey" PRIMARY KEY ("compostReportId");
