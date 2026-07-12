import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { DataExportError, exportMyData } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DownloadData'>;

type State = { kind: 'initial' } | { kind: 'generating' } | { kind: 'ready'; fileUri: string } | { kind: 'error'; message: string };

export function DownloadDataScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ kind: 'initial' });

  async function handleGenerate() {
    setState({ kind: 'generating' });
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const json = await exportMyData(getApiBaseUrl(), token);

      const file = new File(Paths.cache, `creighton-dados-${Date.now()}.json`);
      file.create({ intermediates: true, overwrite: true });
      file.write(json);

      setState({ kind: 'ready', fileUri: file.uri });
      await Sharing.shareAsync(file.uri).catch(() => {});
    } catch (err) {
      if (err instanceof DataExportError && err.code === 'rate_limited') {
        setState({ kind: 'error', message: 'Muitas exportações em pouco tempo. Tente novamente em alguns minutos.' });
      } else {
        setState({ kind: 'error', message: 'Tente novamente em instantes. Se o problema continuar, procure o suporte.' });
      }
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>
      <Text style={styles.title}>Baixar meus dados</Text>

      {state.kind === 'initial' && (
        <View style={styles.content}>
          <Text style={styles.body}>Todos os seus registros, incluindo histórico completo, em formato aberto JSON.</Text>
          <Pressable style={styles.button} onPress={handleGenerate}>
            <Text style={styles.buttonText}>Gerar arquivo</Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'generating' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.subtitle}>Preparando seu arquivo…</Text>
        </View>
      )}

      {state.kind === 'ready' && (
        <View style={styles.center}>
          <Text style={styles.readyTitle}>Arquivo pronto</Text>
          <Pressable style={styles.button} onPress={() => Sharing.shareAsync(state.fileUri).catch(() => {})}>
            <Text style={styles.buttonText}>Compartilhar / baixar</Text>
          </Pressable>
        </View>
      )}

      {state.kind === 'error' && (
        <View style={styles.center}>
          <Text style={styles.readyTitle}>Não foi possível gerar</Text>
          <Text style={styles.subtitle}>{state.message}</Text>
          <Pressable style={styles.button} onPress={handleGenerate}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
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
    marginBottom: spacing.md,
  },
  content: {
    gap: spacing.lg,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
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
});
