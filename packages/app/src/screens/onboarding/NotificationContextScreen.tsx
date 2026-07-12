import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { setReminderEnabled } from '../../settings/notificationPrefs';
import { colors, fonts, radii, spacing } from '../../theme';

interface Props {
  onContinue: () => void;
}

/**
 * SPEC 03 §3.3 item 5 — shown once, right after variant selection, so the
 * OS's one-shot permission prompt never fires without context. The actual
 * `reminderEnabled` pref defaults to true (see notificationPrefs.ts); this
 * screen only flips it to false on an explicit decline, and triggers the
 * real OS prompt on accept.
 */
export function NotificationContextScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const [requesting, setRequesting] = useState(false);

  async function handleEnable() {
    setRequesting(true);
    try {
      await Notifications.requestPermissionsAsync();
    } finally {
      setRequesting(false);
      onContinue();
    }
  }

  async function handleSkip() {
    await setReminderEnabled(false);
    onContinue();
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={styles.title}>O método depende do registro diário.</Text>
      <Text style={styles.body}>Quer que a gente te lembre todo dia, no fim da tarde?</Text>

      <View style={styles.actions}>
        <Pressable style={styles.button} onPress={handleEnable} disabled={requesting}>
          <Text style={styles.buttonText}>{requesting ? 'Um instante…' : 'Ativar lembretes'}</Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={handleSkip} disabled={requesting}>
          <Text style={styles.skipButtonText}>Agora não</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 29,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 21,
  },
  actions: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  skipButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.inkMuted,
  },
});
