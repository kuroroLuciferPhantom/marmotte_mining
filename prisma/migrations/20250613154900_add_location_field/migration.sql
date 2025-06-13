-- AlterTable
ALTER TABLE "users" ADD COLUMN     "location" TEXT NOT NULL DEFAULT 'Chambre chez maman';

-- UpdateTable  
UPDATE "users" SET "tokens" = 0.0 WHERE "tokens" = 100.0;
