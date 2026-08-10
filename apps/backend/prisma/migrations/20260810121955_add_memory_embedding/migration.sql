-- AlterTable
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Memory"
ADD COLUMN "embedding" vector(768);