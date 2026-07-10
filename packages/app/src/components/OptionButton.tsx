import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, minTouchTarget, radii } from '../theme';

interface OptionButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Lay two options side by side (e.g. Sim/Não) instead of stacking vertically. */
  horizontal?: boolean;
}

export function OptionButton({ label, selected, onPress, horizontal }: OptionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.option, selected ? styles.optionSelected : styles.optionUnselected, horizontal && styles.horizontal]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: radii.sm,
    borderWidth: 1.5,
  },
  horizontal: {
    flex: 1,
  },
  optionUnselected: {
    backgroundColor: colors.white,
    borderColor: colors.line,
  },
  optionSelected: {
    backgroundColor: colors.paper,
    borderColor: colors.accent,
  },
  label: {
    fontFamily: fonts.body.medium,
    fontSize: 16,
    color: colors.ink,
  },
});
