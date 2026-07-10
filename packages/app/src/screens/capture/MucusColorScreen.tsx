import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MucusColor } from '@creighton/rules-engine';
import { CaptureScreenLayout } from './CaptureScreenLayout';
import { OptionButton } from '../../components/OptionButton';
import { backStepFor, useCaptureFlow } from './CaptureFlowContext';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MucusColor'>;

// MucusColor.BROWN has no option here — a documented gap (Edu's decision,
// 2026-07-10): the design prototype's 5-option list wins over the briefing
// prose's, and the prototype has no "Marrom" option, only "Com sangue" (RED).
const OPTIONS: { label: string; value: MucusColor }[] = [
  { label: 'Transparente', value: 'CLEAR' },
  { label: 'Turvo', value: 'CLOUDY' },
  { label: 'Branco', value: 'CLOUDY_CLEAR' },
  { label: 'Amarelo claro', value: 'YELLOW' },
  { label: 'Com sangue', value: 'RED' },
];

export function MucusColorScreen({ navigation }: Props) {
  const { answers, setAnswer } = useCaptureFlow();

  function select(value: MucusColor) {
    setAnswer('mucusColor', value);
    navigation.navigate('MucusStretch');
  }

  return (
    <CaptureScreenLayout
      step="mucusColor"
      question="Cor observada"
      onBack={backStepFor('mucusColor', answers.mucusSensation) ? () => navigation.goBack() : undefined}
    >
      {OPTIONS.map((opt) => (
        <OptionButton
          key={opt.value}
          label={opt.label}
          selected={answers.mucusColor === opt.value}
          onPress={() => select(opt.value)}
        />
      ))}
    </CaptureScreenLayout>
  );
}
