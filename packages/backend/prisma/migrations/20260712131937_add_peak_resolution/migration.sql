-- CreateEnum
CREATE TYPE "PeakResolution" AS ENUM ('PENDING', 'CONFIRMED', 'UNCONFIRMED_CLOSED');

-- AlterTable
ALTER TABLE "cycles" ADD COLUMN     "peak_candidate_date" DATE,
ADD COLUMN     "peak_resolution" "PeakResolution" NOT NULL DEFAULT 'PENDING';

-- Backfill (Adendo 02): every existing row already defaulted to PENDING above.
-- Correct the ones we can already classify from existing data — active
-- cycles stay PENDING (correct default); closed cycles get CONFIRMED or
-- UNCONFIRMED_CLOSED based on whether they already have a confirmed_peak_day.
UPDATE "cycles" SET "peak_resolution" = 'CONFIRMED' WHERE "confirmed_peak_day" IS NOT NULL;
UPDATE "cycles" SET "peak_resolution" = 'UNCONFIRMED_CLOSED' WHERE "is_active" = false AND "confirmed_peak_day" IS NULL;
