import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MucusStretch } from '@creighton/rules-engine';
import { CaptureScreenLayout } from './CaptureScreenLayout';
import { OptionButton } from '../../components/OptionButton';
import { backStepFor, useCaptureFlow } from './CaptureFlowContext';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'MucusStretch'>;

const OPTIONS: { label: string; value: MucusStretch }[] = [
  { label: 'Não esticava', value: 'STICKY' },
  { label: 'Esticava um pouco', value: 'TACKY' },
  { label: 'Esticava bastante', value: 'ELASTIC' },
];

export function MucusStretchScreen({ navigation }: Props) {
  const { answers, setAnswer } = useCaptureFlow();

  function select(value: MucusStretch) {
    setAnswer('mucusStretch', value);
    navigation.navigate('Intercourse');
  }

  return (
    <CaptureScreenLayout
      step="mucusStretch"
      question="Esticava?"
      onBack={backStepFor('mucusStretch', answers.mucusSensation) ? () => navigation.goBack() : undefined}
    >
      {OPTIONS.map((opt) => (
        <OptionButton
          key={opt.value}
          label={opt.label}
          selected={answers.mucusStretch === opt.value}
          onPress={() => select(opt.value)}
        />
      ))}
    </CaptureScreenLayout>
  );
}
