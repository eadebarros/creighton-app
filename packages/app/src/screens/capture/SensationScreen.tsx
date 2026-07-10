import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MucusSensation } from '@creighton/rules-engine';
import { CaptureScreenLayout } from './CaptureScreenLayout';
import { OptionButton } from '../../components/OptionButton';
import { backStepFor, useCaptureFlow } from './CaptureFlowContext';
import type { RootStackParamList } from '../../navigation/types';
import { colors, fonts, spacing } from '../../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Sensation'>;

const OPTIONS: { label: string; value: MucusSensation }[] = [
  { label: 'Seco', value: 'DRY' },
  { label: 'Úmido', value: 'DAMP' },
  { label: 'Molhado', value: 'WET' },
  { label: 'Lubrificante', value: 'LUBRICATIVE' },
];

export function SensationScreen({ navigation }: Props) {
  const { answers, setAnswer } = useCaptureFlow();

  function select(value: MucusSensation) {
    setAnswer('mucusSensation', value);
    if (value === 'DRY') {
      // Mucus branch skipped — clear any stale color/stretch from a
      // previously-selected non-Seco path so it doesn't leak into the entry.
      setAnswer('mucusColor', undefined);
      setAnswer('mucusStretch', undefined);
      navigation.navigate('Intercourse');
    } else {
      if (value !== 'DAMP') {
        setAnswer('shinyReflex', undefined);
      }
      navigation.navigate('MucusColor');
    }
  }

  const showShinyCheckbox = answers.mucusSensation === 'DRY' || answers.mucusSensation === 'DAMP';

  return (
    <CaptureScreenLayout
      step="sensation"
      question="Como estava a sensação hoje?"
      onBack={backStepFor('sensation', answers.mucusSensation) ? () => navigation.goBack() : undefined}
    >
      {OPTIONS.map((opt) => (
        <OptionButton
          key={opt.value}
          label={opt.label}
          selected={answers.mucusSensation === opt.value}
          onPress={() => select(opt.value)}
        />
      ))}
      {showShinyCheckbox && (
        <Pressable style={styles.checkboxRow} onPress={() => setAnswer('shinyReflex', !answers.shinyReflex)}>
          <View style={[styles.checkbox, answers.shinyReflex && styles.checkboxChecked]} />
          <Text style={styles.checkboxLabel}>O papel refletiu luz?</Text>
        </Pressable>
      )}
    </CaptureScreenLayout>
  );
}

const styles = StyleSheet.create({
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.ink,
  },
});
