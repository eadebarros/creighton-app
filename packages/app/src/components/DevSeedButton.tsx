import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme';
import { getDb } from '../db/client';
import { newId } from '../db/id';
import { seedFakeCycle } from '../db/devSeed';

/**
 * __DEV__-only affordance for populating a fake 20-day cycle so the chart
 * has something real to show before the capture flow has been used for
 * real. Remove once the golden-path manual pass (Sprint 1 step 10) is done.
 */
export function DevSeedButton() {
  const [status, setStatus] = useState<'idle' | 'seeding' | 'done'>('idle');

  if (!__DEV__) {
    return null;
  }

  async function handlePress() {
    setStatus('seeding');
    const db = await getDb();
    await seedFakeCycle(db, newId);
    setStatus('done');
  }

  return (
    <Pressable style={styles.button} onPress={handlePress}>
      <Text style={styles.text}>{status === 'done' ? 'Ciclo fake semeado ✓' : 'Semear ciclo fake (dev)'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.ink,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    opacity: 0.85,
  },
  text: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.white,
  },
});
