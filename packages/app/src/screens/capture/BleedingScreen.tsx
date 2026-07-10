import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BleedingType } from '@creighton/rules-engine';
import { CaptureScreenLayout } from './CaptureScreenLayout';
import { OptionButton } from '../../components/OptionButton';
import { useCaptureFlow } from './CaptureFlowContext';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Bleeding'>;

const OPTIONS: { label: string; value: BleedingType }[] = [
  { label: 'Não', value: 'NONE' },
  { label: 'Muito leve', value: 'VL' },
  { label: 'Leve', value: 'L' },
  { label: 'Moderado', value: 'M' },
  { label: 'Intenso', value: 'H' },
];

export function BleedingScreen({ navigation }: Props) {
  const { answers, setAnswer } = useCaptureFlow();

  function select(value: BleedingType) {
    setAnswer('bleedingType', value);
    navigation.navigate('Sensation');
  }

  return (
    <CaptureScreenLayout step="bleeding" question="Teve sangramento hoje?">
      {OPTIONS.map((opt) => (
        <OptionButton
          key={opt.value}
          label={opt.label}
          selected={answers.bleedingType === opt.value}
          onPress={() => select(opt.value)}
        />
      ))}
    </CaptureScreenLayout>
  );
}
