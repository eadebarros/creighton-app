-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PRIMARY_OBSERVER', 'COOP_PARTNER');

-- CreateEnum
CREATE TYPE "VariantMode" AS ENUM ('REGULAR', 'LACTATION', 'MENOPAUSE', 'BIP');

-- CreateEnum
CREATE TYPE "BleedingType" AS ENUM ('H', 'M', 'L', 'VL', 'B', 'NONE');

-- CreateEnum
CREATE TYPE "MucusSensation" AS ENUM ('DRY', 'DAMP', 'WET', 'LUBRICATIVE');

-- CreateEnum
CREATE TYPE "MucusStretch" AS ENUM ('NONE', 'STICKY', 'TACKY', 'ELASTIC');

-- CreateEnum
CREATE TYPE "MucusColor" AS ENUM ('CLEAR', 'CLOUDY', 'CLOUDY_CLEAR', 'YELLOW', 'BROWN', 'RED');

-- CreateEnum
CREATE TYPE "EntrySource" AS ENUM ('USER', 'INSTRUCTOR_CORRECTION');

-- CreateEnum
CREATE TYPE "FertilityState" AS ENUM ('FERTILE', 'INFERTILE_ALTERNATING', 'INFERTILE_ABSOLUTE');

-- CreateEnum
CREATE TYPE "PeakRelation" AS ENUM ('PRE_PEAK', 'CANDIDATE', 'P', 'P1', 'P2', 'P3', 'P4_PLUS', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PRIMARY_OBSERVER',
    "partner_id" UUID,
    "current_variant_mode" "VariantMode" NOT NULL DEFAULT 'REGULAR',
    "instructor_credential_ack" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "variant_mode_snapshot" "VariantMode" NOT NULL,
    "confirmed_peak_day" DATE,
    "peak_day_confirmed_at" TIMESTAMP(3),

    CONSTRAINT "cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_entries" (
    "id" UUID NOT NULL,
    "cycle_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "bleeding_type" "BleedingType" NOT NULL,
    "mucus_sensation" "MucusSensation" NOT NULL,
    "mucus_stretch" "MucusStretch" NOT NULL,
    "mucus_color" "MucusColor",
    "shiny_reflex" BOOLEAN,
    "raw_code" TEXT NOT NULL,
    "intercourse" BOOLEAN NOT NULL,
    "peak_override_by_instructor" BOOLEAN NOT NULL DEFAULT false,
    "entered_at" TIMESTAMP(3) NOT NULL,
    "entry_source" "EntrySource" NOT NULL DEFAULT 'USER',

    CONSTRAINT "daily_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_fertility_states" (
    "id" UUID NOT NULL,
    "daily_entry_id" UUID NOT NULL,
    "computed_state" "FertilityState" NOT NULL,
    "peak_relation" "PeakRelation" NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rule_engine_version" TEXT NOT NULL,
    "superseded_by" UUID,

    CONSTRAINT "daily_fertility_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "cycles_user_id_is_active_idx" ON "cycles"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "daily_entries_cycle_id_date_key" ON "daily_entries"("cycle_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_fertility_states_superseded_by_key" ON "daily_fertility_states"("superseded_by");

-- CreateIndex
CREATE INDEX "daily_fertility_states_daily_entry_id_superseded_by_idx" ON "daily_fertility_states"("daily_entry_id", "superseded_by");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycles" ADD CONSTRAINT "cycles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_fertility_states" ADD CONSTRAINT "daily_fertility_states_daily_entry_id_fkey" FOREIGN KEY ("daily_entry_id") REFERENCES "daily_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_fertility_states" ADD CONSTRAINT "daily_fertility_states_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "daily_fertility_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;
