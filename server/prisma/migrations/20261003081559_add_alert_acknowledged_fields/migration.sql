-- AlterTable
ALTER TABLE "Alert" ADD COLUMN     "acknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "acknowledgedAt" TIMESTAMP(3);
