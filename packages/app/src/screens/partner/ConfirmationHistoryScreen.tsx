import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { getPartnerAcknowledgments } from '../../api/client';
import type { AcknowledgmentSummary } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { colors, fonts, spacing } from '../../theme';

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: AcknowledgmentSummary[] };

interface Props {
  onBack: () => void;
}

function formatTimeLeft(acknowledgedAt: string): string {
  return new Date(acknowledgedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function ConfirmationHistoryScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('no token');
        const items = await getPartnerAcknowledgments(getApiBaseUrl(), token);
        setState({ kind: 'ready', items });
      } catch {
        setState({ kind: 'error' });
      }
    })();
  }, [getToken]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>

      <Text style={styles.title}>Histórico de confirmações</Text>

      {state.kind === 'loading' && <Text style={styles.subtitle}>Carregando…</Text>}
      {state.kind === 'error' && <Text style={styles.subtitle}>Não foi possível carregar o histórico agora.</Text>}
      {state.kind === 'ready' && state.items.length === 0 && (
        <Text style={styles.subtitle}>Nenhuma confirmação registrada ainda.</Text>
      )}

      {state.kind === 'ready' && state.items.length > 0 && (
        <FlatList
          data={state.items}
          keyExtractor={(item) => item.date}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowDate}>{item.date}</Text>
              <Text style={styles.rowMeta}>Visto às {formatTimeLeft(item.acknowledgedAt)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowDate: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
  },
});
