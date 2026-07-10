import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

interface ProgressDotsProps {
  total: number;
  /** -1 hides all dots (used on the Confirmation screen). */
  activeIndex: number;
}

export function ProgressDots({ total, activeIndex }: ProgressDotsProps) {
  if (activeIndex < 0) {
    return null;
  }
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  dotActive: {
    backgroundColor: colors.accent,
  },
  dotInactive: {
    backgroundColor: colors.line,
  },
});
