import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CaptureScreenLayout } from './CaptureScreenLayout';
import { OptionButton } from '../../components/OptionButton';
import { backStepFor, useCaptureFlow } from './CaptureFlowContext';
import type { RootStackParamList } from '../../navigation/types';
import { getDb } from '../../db/client';
import { newId } from '../../db/id';
import { recordEntry } from '../../db/entryRepository';
import { today } from '../../domain/dateMath';
import type { CaptureAnswers } from '../../domain/mapping';

type Props = NativeStackScreenProps<RootStackParamList, 'Intercourse'>;

export function IntercourseScreen({ navigation }: Props) {
  const { answers, setAnswer, reset } = useCaptureFlow();
  const [saving, setSaving] = useState(false);

  async function select(value: boolean) {
    if (saving) {
      return;
    }
    setSaving(true);
    setAnswer('intercourse', value);

    const completeAnswers: CaptureAnswers = {
      bleedingType: answers.bleedingType ?? 'NONE',
      mucusSensation: answers.mucusSensation ?? 'DRY',
      shinyReflex: answers.shinyReflex,
      mucusColor: answers.mucusColor,
      mucusStretch: answers.mucusStretch,
      intercourse: value,
    };

    const db = await getDb();
    await recordEntry(db, completeAnswers, today(), newId);
    reset();
    navigation.navigate('Confirmation');
  }

  return (
    <CaptureScreenLayout
      step="intercourse"
      question="Houve relação sexual hoje?"
      onBack={backStepFor('intercourse', answers.mucusSensation) ? () => navigation.goBack() : undefined}
    >
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <OptionButton label="Sim" selected={false} onPress={() => select(true)} horizontal />
        <OptionButton label="Não" selected={false} onPress={() => select(false)} horizontal />
      </View>
    </CaptureScreenLayout>
  );
}
