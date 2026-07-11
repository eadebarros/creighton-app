import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii, spacing } from '../../theme';

interface Props {
  onContinue: () => void;
}

/** First-ever-launch disclaimer — writes User.instructorCredentialAck via OnboardingScreen once acknowledged. */
export function WelcomeDisclaimerScreen({ onContinue }: Props) {
  const insets = useSafeAreaInsets();
  const [ack, setAck] = useState(false);

  return (
    <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Text style={styles.eyebrow}>Creighton Tracker</Text>
      <Text style={styles.title}>Acompanhamento de precisão, sob orientação de instrutora credenciada.</Text>
      <Text style={styles.body}>
        Não é um app de bem-estar de ciclo. É um instrumento clínico de casal para o Método de Ovulação
        Creighton, usado em conjunto com sua instrutora.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>O que este app faz</Text>
        <Text style={styles.cardBody}>
          Registra suas observações diárias e calcula o padrão do ciclo segundo o método Creighton.
        </Text>
        <Text style={styles.cardLabel}>O que este app não faz</Text>
        <Text style={styles.cardBody}>
          Não substitui orientação médica ou da instrutora, nem faz diagnóstico.
        </Text>
      </View>

      <Pressable style={styles.ackRow} onPress={() => setAck((v) => !v)}>
        <View style={[styles.checkbox, ack && styles.checkboxChecked]}>
          {ack && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.ackText}>
          Estou ciente de que este app funciona sob orientação de instrutora Creighton credenciada.
        </Text>
      </Pressable>

      <Pressable
        style={[styles.button, !ack && styles.buttonDisabled]}
        onPress={onContinue}
        disabled={!ack}
      >
        <Text style={[styles.buttonText, !ack && styles.buttonTextDisabled]}>Continuar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
  },
  eyebrow: {
    fontFamily: fonts.mono.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 29,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  cardLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.ink,
  },
  cardBody: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  ackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  ackText: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
    flex: 1,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: {
    backgroundColor: colors.line,
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  buttonTextDisabled: {
    color: colors.inkMuted,
  },
});
