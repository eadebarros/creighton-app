import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { OptionButton } from '../../components/OptionButton';
import {
  getNotificationPrefs,
  setEscalationEnabled,
  setReminderEnabled,
  setReminderTime,
} from '../../settings/notificationPrefs';
import { rescheduleReminders } from '../../settings/notificationScheduler';
import { colors, fonts, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const TIME_PRESETS = ['19:00', '20:00', '21:00', '22:00'];

export function NotificationsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [reminderEnabled, setReminderEnabledState] = useState(false);
  const [reminderTime, setReminderTimeState] = useState('21:00');
  const [escalationEnabled, setEscalationEnabledState] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  async function load() {
    const prefs = await getNotificationPrefs();
    setReminderEnabledState(prefs.reminderEnabled);
    setReminderTimeState(prefs.reminderTime);
    setEscalationEnabledState(prefs.escalationEnabled);
    const permissions = await Notifications.getPermissionsAsync();
    setPermissionDenied(prefs.reminderEnabled && !permissions.granted);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggleReminder(value: boolean) {
    if (value) {
      const permissions = await Notifications.requestPermissionsAsync();
      if (!permissions.granted) {
        setPermissionDenied(true);
        return;
      }
    }
    setPermissionDenied(false);
    setReminderEnabledState(value);
    await setReminderEnabled(value);
    await rescheduleReminders();
  }

  async function handleSelectTime(time: string) {
    setReminderTimeState(time);
    await setReminderTime(time);
    await rescheduleReminders();
  }

  async function handleToggleEscalation(value: boolean) {
    setEscalationEnabledState(value);
    await setEscalationEnabled(value);
    await rescheduleReminders();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>
      <Text style={styles.title}>Notificações</Text>

      <View style={styles.row}>
        <Text style={styles.rowLabel}>Lembrete de registro diário</Text>
        <Switch
          value={reminderEnabled}
          onValueChange={handleToggleReminder}
          trackColor={{ false: colors.line, true: colors.accent }}
        />
      </View>

      {permissionDenied && (
        <View style={styles.deniedBox}>
          <Text style={styles.deniedText}>Permissão negada pelo sistema.</Text>
          <Pressable onPress={() => Linking.openSettings()}>
            <Text style={styles.deniedLink}>Abrir ajustes do sistema</Text>
          </Pressable>
        </View>
      )}

      {reminderEnabled && !permissionDenied && (
        <>
          <Text style={styles.subLabel}>Horário</Text>
          <View style={styles.presetRow}>
            {TIME_PRESETS.map((time) => (
              <OptionButton key={time} label={time} selected={reminderTime === time} onPress={() => handleSelectTime(time)} />
            ))}
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Insistir se eu esquecer</Text>
            <Switch
              value={escalationEnabled}
              onValueChange={handleToggleEscalation}
              trackColor={{ false: colors.line, true: colors.accent }}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
  },
  back: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 24,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 48,
  },
  rowLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 15,
    color: colors.ink,
    maxWidth: 230,
  },
  subLabel: {
    fontFamily: fonts.body.medium,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  deniedBox: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  deniedText: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
  },
  deniedLink: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.accent,
  },
});
