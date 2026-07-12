import * as Notifications from 'expo-notifications';
import { getDb } from '../db/client';
import { getActiveCycle } from '../db/cycleRepository';
import { hasEntryForDate } from '../db/entryRepository';
import { today } from '../domain/dateMath';
import { getNotificationPrefs } from './notificationPrefs';

const MAIN_ID = 'creighton-daily-reminder';
const ESCALATION_ID = 'creighton-daily-reminder-escalation';

// Deliberately generic — never references fertility state, stamp color, or
// cycle phase (SPEC 03 §3.3): this appears on a locked screen, visible to
// anyone glancing at the phone.
const NOTIFICATION_TITLE = 'Creighton Tracker';
const NOTIFICATION_BODY = 'Hora do seu registro de hoje';

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = hhmm.split(':');
  return { hour: Number(hourStr) || 21, minute: Number(minuteStr) || 0 };
}

/**
 * Local-only reminder (no push, no backend — SPEC 03 §3.3). There's no native
 * "recurring but skippable-per-day" trigger, so instead of a repeating
 * schedule this recomputes a single upcoming DATE trigger every time it's
 * called: on app foreground (useSyncLifecycle) and right after a same-day
 * observation is recorded (IntercourseScreen, the last step of capture).
 * Always cancels-then-recomputes under the same two fixed identifiers, so
 * it's safe to call redundantly and naturally self-heals after a device
 * reboot or timezone change (the next call just recomputes from scratch).
 */
export async function rescheduleReminders(): Promise<void> {
  await Promise.all([
    Notifications.cancelScheduledNotificationAsync(MAIN_ID).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(ESCALATION_ID).catch(() => {}),
  ]);

  const prefs = await getNotificationPrefs();
  if (!prefs.reminderEnabled) {
    return;
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    return;
  }

  const db = await getDb();
  const activeCycle = await getActiveCycle(db);
  const recordedToday = activeCycle ? await hasEntryForDate(db, activeCycle.id, today()) : false;

  const now = new Date();
  const { hour, minute } = parseTime(prefs.reminderTime);
  const mainDate = new Date(now);
  mainDate.setHours(hour, minute, 0, 0);
  if (recordedToday || mainDate.getTime() <= now.getTime()) {
    mainDate.setDate(mainDate.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: MAIN_ID,
    content: { title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: mainDate },
  });

  if (prefs.escalationEnabled) {
    const escalationDate = new Date(mainDate.getTime() + 2 * 60 * 60 * 1000);
    await Notifications.scheduleNotificationAsync({
      identifier: ESCALATION_ID,
      content: { title: NOTIFICATION_TITLE, body: NOTIFICATION_BODY },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: escalationDate },
    });
  }
}
