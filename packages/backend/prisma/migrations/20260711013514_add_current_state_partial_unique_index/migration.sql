-- Defense-in-depth: guarantees at the DB level that a daily_entry can have
-- at most one "current" (non-superseded) DailyFertilityState row, even if a
-- future service-layer bug tried to insert two. Not expressible as a plain
-- @@unique in schema.prisma (partial/conditional indexes aren't supported by
-- the Prisma schema DSL), so this is a hand-written raw migration.
CREATE UNIQUE INDEX "daily_fertility_states_current_per_entry"
  ON "daily_fertility_states" ("daily_entry_id")
  WHERE "superseded_by" IS NULL;
