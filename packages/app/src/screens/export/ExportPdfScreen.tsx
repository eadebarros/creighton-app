import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ExportPdfError, exportPdf } from '../../api/client';
import type { ExportPeriod } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { OptionButton } from '../../components/OptionButton';
import { TextField } from '../../components/TextField';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';
import { validateExportForm } from './exportValidation';

type Props = NativeStackScreenProps<RootStackParamList, 'ExportPdf'>;

const PERIOD_OPTIONS: { key: ExportPeriod; label: string }[] = [
  { key: 'current', label: 'Ciclo atual' },
  { key: 'last3', label: 'Últimos 3 ciclos' },
  { key: 'custom', label: 'Personalizado' },
];

type State =
  | { kind: 'configuring'; error: string | null }
  | { kind: 'generating' }
  | { kind: 'ready'; fileUri: string }
  | { kind: 'error'; message: string };

export function ExportPdfScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [period, setPeriod] = useState<ExportPeriod>('current');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<State>({ kind: 'configuring', error: null });

  async function handleGenerate() {
    const validationError = validateExportForm({ period, customStart, customEnd, password });
    if (validationError) {
      setState({ kind: 'configuring', error: validationError });
      return;
    }

    setState({ kind: 'generating' });
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const buffer = await exportPdf(getApiBaseUrl(), token, {
        period,
        customStart: period === 'custom' ? customStart : undefined,
        customEnd: period === 'custom' ? customEnd : undefined,
        password,
      });

      const file = new File(Paths.cache, `creighton-export-${Date.now()}.pdf`);
      file.create({ intermediates: true, overwrite: true });
      file.write(new Uint8Array(buffer));

      setState({ kind: 'ready', fileUri: file.uri });
      await Sharing.shareAsync(file.uri).catch(() => {});
    } catch (err) {
      if (err instanceof ExportPdfError && err.code === 'insufficient_data') {
        setState({ kind: 'error', message: 'O período selecionado não tem dados suficientes. Escolha um intervalo com pelo menos um ciclo completo.' });
      } else if (err instanceof ExportPdfError && err.code === 'rate_limited') {
        setState({ kind: 'error', message: 'Muitas exportações em pouco tempo. Tente novamente em alguns minutos.' });
      } else {
        setState({ kind: 'error', message: 'Não foi possível gerar o PDF agora. Tente novamente.' });
      }
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>

      <Text style={styles.title}>Exportar para instrutora</Text>

      {state.kind === 'configuring' && (
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={styles.label}>Período</Text>
          <View style={styles.periodRow}>
            {PERIOD_OPTIONS.map((opt) => (
              <OptionButton key={opt.key} label={opt.label} selected={period === opt.key} onPress={() => setPeriod(opt.key)} horizontal />
            ))}
          </View>

          {period === 'custom' && (
            <View style={styles.customDates}>
              <TextField label="De (AAAA-MM-DD)" value={customStart} onChangeText={setCustomStart} placeholder="2026-01-01" />
              <TextField label="Até (AAAA-MM-DD)" value={customEnd} onChangeText={setCustomEnd} placeholder="2026-03-01" />
            </View>
          )}

          <TextField
            label="Senha do PDF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Defina uma senha"
            error={state.error ?? undefined}
          />
          <Text style={styles.note}>Essa senha não fica salva em nenhum lugar — guarde-a para compartilhar com sua instrutora.</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Incluído no relatório</Text>
            <Text style={styles.infoBoxBody}>Gráfico do ciclo · Dados brutos de observação</Text>
          </View>

          <Pressable style={styles.button} onPress={handleGenerate}>
            <Text style={styles.buttonText}>Gerar PDF</Text>
          </Pressable>
        </ScrollView>
      )}

      {state.kind === 'generating' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.subtitle}>Gerando PDF protegido…</Text>
        </View>
      )}

      {state.kind === 'ready' && (
        <View style={styles.center}>
          <Text style={styles.readyTitle}>PDF pronto</Text>
          <Pressable style={styles.button} onPress={() => Sharing.shareAsync(state.fileUri).catch(() => {})}>
            <Text style={styles.buttonText}>Compartilhar / baixar</Text>
          </Pressable>
          <Pressable onPress={() => setState({ kind: 'configuring', error: null })}>
            <Text style={styles.link}>Fazer outra exportação</Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'error' && (
        <View style={styles.center}>
          <Text style={styles.readyTitle}>Não foi possível gerar</Text>
          <Text style={styles.subtitle}>{state.message}</Text>
          <Pressable style={styles.button} onPress={() => setState({ kind: 'configuring', error: null })}>
            <Text style={styles.buttonText}>Escolher outro período</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
  },
  back: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  label: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  customDates: {
    gap: spacing.sm,
  },
  note: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: -spacing.xs,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.white,
  },
  infoBoxTitle: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  infoBoxBody: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.ink,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  readyTitle: {
    fontFamily: fonts.display.medium,
    fontSize: 18,
    color: colors.ink,
  },
  link: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
    marginTop: spacing.sm,
  },
});
