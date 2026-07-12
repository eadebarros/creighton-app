import { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@clerk/expo';
import { voidObservationRemote } from '../api/client';
import { getApiBaseUrl } from '../api/config';
import { getDb } from '../db/client';
import { getObservationsForDate, voidObservation } from '../db/observationRepository';
import type { ObservationRow } from '../db/observationRepository';
import { colors, fonts, radii, spacing } from '../theme';

interface Props {
  cycleId: string;
  date: string;
  onClose: () => void;
  /** Called after a void changes the day's consolidated peak, so the caller can refresh the chart. */
  onChanged: () => void;
}

function formatTime(observedAt: string): string {
  return new Date(observedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Functional-first "anular observação" sheet (Adendo 01, Seção 3) — no elaborate design yet. */
export function ObservationsSheet({ cycleId, date, onClose, onChanged }: Props) {
  const { getToken } = useAuth();
  const [observations, setObservations] = useState<ObservationRow[] | null>(null);

  async function reload() {
    const db = await getDb();
    setObservations(await getObservationsForDate(db, cycleId, date));
  }

  useEffect(() => {
    reload();
  }, [cycleId, date]);

  function handleVoid(observation: ObservationRow) {
    Alert.alert('Anular observação', `Anular a observação das ${formatTime(observation.observed_at)}? Isso não pode ser desfeito.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular',
        style: 'destructive',
        onPress: async () => {
          const db = await getDb();
          await voidObservation(db, observation.id);
          await reload();
          onChanged();
          // Fire-and-forget: the local void already applied — the server
          // just needs to eventually learn about it (partner dashboard,
          // PDF export's voided count). Never blocks the UI.
          getToken()
            .then((token) => (token ? voidObservationRemote(getApiBaseUrl(), token, observation.id) : undefined))
            .catch(() => {});
        },
      },
    ]);
  }

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Observações do dia</Text>
        {observations === null && <Text style={styles.subtitle}>Carregando…</Text>}
        {observations?.map((obs) => (
          <View key={obs.id} style={styles.row}>
            <View>
              <Text style={styles.rowTime}>{formatTime(obs.observed_at)}</Text>
              <Text style={[styles.rowCode, obs.voided === 1 && styles.rowCodeVoided]}>{obs.raw_code || '—'}</Text>
            </View>
            {obs.voided === 1 ? (
              <Text style={styles.voidedLabel}>Anulada</Text>
            ) : (
              <Pressable onPress={() => handleVoid(obs)}>
                <Text style={styles.voidLabel}>Anular</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Fechar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 18,
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowTime: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.ink,
  },
  rowCode: {
    fontFamily: fonts.mono.medium,
    fontSize: 13,
    color: colors.inkMuted,
  },
  rowCodeVoided: {
    textDecorationLine: 'line-through',
  },
  voidLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.ink,
  },
  voidedLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
  },
  closeButton: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  closeButtonText: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
});
