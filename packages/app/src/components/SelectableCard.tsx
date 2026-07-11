import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  disabledNote?: string;
}

/** A richer alternative to <OptionButton> for choices that need a title + description, not just a label. */
export function SelectableCard({ title, description, selected, onPress, disabled, disabledNote }: Props) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[styles.card, selected ? styles.selected : styles.unselected, disabled && styles.disabled]}
    >
      <Text style={[styles.title, disabled && styles.disabledText]}>{title}</Text>
      <Text style={[styles.description, disabled && styles.disabledText]}>{description}</Text>
      {disabled && disabledNote && <Text style={styles.badge}>{disabledNote}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1.5,
    padding: spacing.lg,
  },
  unselected: {
    backgroundColor: colors.white,
    borderColor: colors.line,
  },
  selected: {
    backgroundColor: colors.paper,
    borderColor: colors.accent,
  },
  disabled: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    opacity: 0.55,
  },
  disabledText: {
    color: colors.inkMuted,
  },
  badge: {
    fontFamily: fonts.body.semiBold,
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 17,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  description: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 18,
  },
});
