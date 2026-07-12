import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { VariantMode } from '@creighton/rules-engine';
import { SelectableCard } from '../../components/SelectableCard';
import { colors, fonts, radii, spacing } from '../../theme';

interface Props {
  onContinue: (variant: VariantMode) => void;
}

const VARIANTS: { key: VariantMode; title: string; description: string; implemented: boolean }[] = [
  { key: 'REGULAR', title: 'Regular', description: 'Ciclos com padrão de fertilidade típico.', implemented: true },
  { key: 'LACTATION', title: 'Lactação', description: 'Pós-parto, amamentação em curso.', implemented: true },
  { key: 'MENOPAUSE', title: 'Pré-menopausa', description: 'Ciclos irregulares por transição hormonal.', implemented: true },
];
export function VariantSelectionScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<VariantMode>('REGULAR');

  return (
    <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={styles.title}>Qual acompanhamento se aplica hoje?</Text>
      <Text style={styles.subtitle}>Isso define como seu padrão será calculado.</Text>

      {VARIANTS.map((v) => (
        <SelectableCard
          key={v.key}
          title={v.title}
          description={v.description}
          selected={selected === v.key}
          onPress={() => setSelected(v.key)}
          disabled={!v.implemented}
          disabledNote={v.implemented ? undefined : 'Em breve'}
        />
      ))}

      <Pressable style={styles.button} onPress={() => onContinue(selected)}>
        <Text style={styles.buttonText}>Continuar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
    marginBottom: spacing.sm,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
});
