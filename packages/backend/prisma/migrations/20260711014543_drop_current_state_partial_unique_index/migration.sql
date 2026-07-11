-- Reverts the previous migration: Postgres partial unique indexes can't be
-- DEFERRABLE, but recomputeCycleFertilityStates() must create the successor
-- row (supersededById NULL) before it can point the old row at it — so both
-- rows are transiently "current" within the same transaction, which this
-- index rejected immediately rather than at commit. Correctness instead
-- relies on the per-cycle advisory lock (pg_advisory_xact_lock in
-- recomputeCycle.ts) serializing recomputes, plus the application logic
-- itself only ever creating one successor per stale row.
DROP INDEX "daily_fertility_states_current_per_entry";
