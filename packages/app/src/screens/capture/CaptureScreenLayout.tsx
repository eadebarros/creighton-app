import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../../theme';
import { ProgressDots } from '../../components/ProgressDots';
import { dotIndexForStep, totalDots, useCaptureFlow } from './CaptureFlowContext';
import type { CaptureStep } from './CaptureFlowContext';
import { useCycleDay } from './useCycleDay';

interface CaptureScreenLayoutProps {
  step: CaptureStep;
  question: string;
  onBack?: () => void;
  children: ReactNode;
}

export function CaptureScreenLayout({ step, question, onBack, children }: CaptureScreenLayoutProps) {
  const { answers } = useCaptureFlow();
  const cycleDay = useCycleDay();
  const insets = useSafeAreaInsets();
  const dots = totalDots(answers.mucusSensation);
  const activeDot = dotIndexForStep(step, answers.mucusSensation);

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
      ]}
    >
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack}>
            <Text style={styles.back}>← Voltar</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <ProgressDots total={dots} activeIndex={activeDot} />
      </View>
      <Text style={styles.dayLabel}>Dia {cycleDay ?? '—'} do ciclo</Text>
      <Text style={styles.question}>{question}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  back: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
  dayLabel: {
    fontFamily: fonts.display.medium,
    fontSize: 15,
    color: colors.inkMuted,
    marginTop: spacing.xl,
  },
  question: {
    fontFamily: fonts.display.medium,
    fontSize: 26,
    color: colors.ink,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  content: {
    gap: spacing.md,
  },
});
