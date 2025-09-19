-- AlterTable
ALTER TABLE "public"."_TransactionToUser" ADD CONSTRAINT "_TransactionToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "public"."_TransactionToUser_AB_unique";
