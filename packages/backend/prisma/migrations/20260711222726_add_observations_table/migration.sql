-- AlterTable
ALTER TABLE "daily_entries" ADD COLUMN     "consolidated_at" TIMESTAMP(3),
ADD COLUMN     "peak_observation_id" UUID;

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "observed_at" TIMESTAMP(3) NOT NULL,
    "bleeding_type" "BleedingType" NOT NULL,
    "mucus_sensation" "MucusSensation" NOT NULL,
    "mucus_stretch" "MucusStretch" NOT NULL,
    "mucus_color" "MucusColor",
    "shiny_reflex" BOOLEAN,
    "raw_code" TEXT NOT NULL,
    "intercourse" BOOLEAN NOT NULL,
    "entry_source" "EntrySource" NOT NULL DEFAULT 'USER',
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMP(3),

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "observations_cycle_id_date_idx" ON "observations"("cycle_id", "date");

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (Adendo 01): every existing DailyEntry becomes exactly one
-- Observation (observed_at = entered_at, voided = false), then the
-- DailyEntry row is pointed at it as its own peak — a pre-existing
-- single-observation day trivially "wins" pickDailyPeak against itself.
INSERT INTO "observations" (id, cycle_id, date, observed_at, bleeding_type, mucus_sensation, mucus_stretch, mucus_color, shiny_reflex, raw_code, intercourse, entry_source, voided)
SELECT gen_random_uuid(), cycle_id, date, entered_at, bleeding_type, mucus_sensation, mucus_stretch, mucus_color, shiny_reflex, raw_code, intercourse, entry_source, false
FROM "daily_entries";

UPDATE "daily_entries" e
SET peak_observation_id = o.id, consolidated_at = e.entered_at
FROM "observations" o
WHERE o.cycle_id = e.cycle_id AND o.date = e.date;

-- CreateIndex
CREATE UNIQUE INDEX "daily_entries_peak_observation_id_key" ON "daily_entries"("peak_observation_id");

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_peak_observation_id_fkey" FOREIGN KEY ("peak_observation_id") REFERENCES "observations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
