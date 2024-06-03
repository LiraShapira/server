-- DropIndex
DROP INDEX "Event_locationId_key";

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "eventId" TEXT;
