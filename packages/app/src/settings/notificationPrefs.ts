import * as SecureStore from 'expo-secure-store';

const REMINDER_ENABLED_KEY = 'creighton.notif.reminderEnabled';
const REMINDER_TIME_KEY = 'creighton.notif.reminderTime';
const ESCALATION_ENABLED_KEY = 'creighton.notif.escalationEnabled';

/** SPEC 03 §3.3 — end-of-day default: the "peak of the day" can only be consolidated once all of today's observations are in. */
export const DEFAULT_REMINDER_TIME = '21:00';

export interface NotificationPrefs {
  reminderEnabled: boolean;
  /** "HH:mm", 24h, device-local. */
  reminderTime: string;
  escalationEnabled: boolean;
}

/** Reminder defaults to ON (opt-out) per Edu's decision — daily registro is treated as core to the method, not an accessory toggle. Escalation defaults to OFF. */
export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const [enabled, time, escalation] = await Promise.all([
    SecureStore.getItemAsync(REMINDER_ENABLED_KEY),
    SecureStore.getItemAsync(REMINDER_TIME_KEY),
    SecureStore.getItemAsync(ESCALATION_ENABLED_KEY),
  ]);
  return {
    reminderEnabled: enabled === null ? true : enabled === 'true',
    reminderTime: time ?? DEFAULT_REMINDER_TIME,
    escalationEnabled: escalation === 'true',
  };
}

export async function setReminderEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(REMINDER_ENABLED_KEY, String(enabled));
}

export async function setReminderTime(time: string): Promise<void> {
  await SecureStore.setItemAsync(REMINDER_TIME_KEY, time);
}

export async function setEscalationEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(ESCALATION_ENABLED_KEY, String(enabled));
}
