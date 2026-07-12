import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

export function estimatePasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score++;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, Math.min(4, score));
}

const STRENGTH_LABELS = ['Fraca', 'Razoável', 'Boa', 'Forte'];

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = estimatePasswordStrength(password);
  return (
    <View>
      <View style={styles.strengthBars}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.strengthBar, i < strength && styles.strengthBarFilled]} />
        ))}
      </View>
      <Text style={styles.strengthLabel}>{STRENGTH_LABELS[strength - 1]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strengthBars: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  strengthBarFilled: {
    backgroundColor: colors.accent,
  },
  strengthLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
});
