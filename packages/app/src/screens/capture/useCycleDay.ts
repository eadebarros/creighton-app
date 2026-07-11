import { useEffect, useState } from 'react';
import { daysBetween } from '@creighton/rules-engine';
import { getDb } from '../../db/client';
import { getActiveCycle } from '../../db/cycleRepository';
import { today } from '../../domain/dateMath';

/** "Dia N do ciclo" — day 1 for a brand-new cycle that doesn't exist yet. */
export function useCycleDay(): number | null {
  const [cycleDay, setCycleDay] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const active = await getActiveCycle(db);
      const day = active ? daysBetween(active.startDate, today()) + 1 : 1;
      if (!cancelled) {
        setCycleDay(day);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return cycleDay;
}
