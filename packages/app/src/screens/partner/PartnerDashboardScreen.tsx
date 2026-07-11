import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { postPartnerAcknowledge } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { PartnerStatusCircle } from '../../components/PartnerStatusCircle';
import { peakRelationLabel } from '../chart/chartGrouping';
import { colors, fonts, radii, spacing } from '../../theme';
import { usePartnerStatusPolling } from '../../sync/usePartnerStatusPolling';
import { ConfirmationHistoryScreen } from './ConfirmationHistoryScreen';
import { partnerStatusCopy } from './partnerStatusCopy';

export function PartnerDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { getToken, signOut } = useAuth();
  const { state, refresh } = usePartnerStatusPolling();
  const [acknowledging, setAcknowledging] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (showHistory) {
    return <ConfirmationHistoryScreen onBack={() => setShowHistory(false)} />;
  }

  async function handleAcknowledge() {
    setAcknowledging(true);
    try {
      const token = await getToken();
      if (token) {
        await postPartnerAcknowledge(getApiBaseUrl(), token);
      }
      refresh();
    } catch {
      // best-effort — the button just stays enabled for a retry
    } finally {
      setAcknowledging(false);
    }
  }

  const status = state.kind === 'ready' ? state.status : null;
  const phaseLabel = status?.peakRelation ? peakRelationLabel(status.peakRelation) : null;
  const awaitingToday = Boolean(status?.hasActiveCycle && status.asOfDate && status.asOfDate !== status.today);
  const copy = status && !awaitingToday ? partnerStatusCopy(status.colorToken) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        {state.kind === 'error' && <Text style={styles.subtitle}>Sem conexão no momento.</Text>}
        {state.kind === 'loading' && <Text style={styles.subtitle}>Carregando…</Text>}
        {status && !status.hasActiveCycle && <Text style={styles.subtitle}>Nenhum ciclo registrado ainda.</Text>}

        {status?.hasActiveCycle && (
          <>
            <PartnerStatusCircle color={status.colorToken} pending={awaitingToday} />
            <Text style={styles.dayLabel}>Dia {status.cycleDay} do ciclo</Text>
            {phaseLabel && <Text style={styles.phaseLabel}>{phaseLabel}</Text>}
            {awaitingToday && <Text style={styles.staleNote}>Aguardando registro de hoje</Text>}
            {copy && <Text style={styles.statusCopy}>{copy}</Text>}
          </>
        )}

        <Pressable
          style={[styles.button, status?.acknowledgedToday && styles.buttonDone]}
          onPress={handleAcknowledge}
          disabled={acknowledging || status?.acknowledgedToday}
        >
          <Text style={styles.buttonText}>{status?.acknowledgedToday ? 'Você confirmou hoje ✓' : 'Confirmar que vi'}</Text>
        </Pressable>

        <Pressable onPress={() => setShowHistory(true)}>
          <Text style={styles.historyLink}>Ver histórico</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => signOut()}>
        <Text style={styles.signOutLabel}>Sair</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
  },
  dayLabel: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  phaseLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.accent,
  },
  staleNote: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
  },
  statusCopy: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  historyLink: {
    fontFamily: fonts.body.medium,
    fontSize: 13,
    color: colors.accent,
    marginTop: spacing.xl,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  buttonDone: {
    backgroundColor: colors.green,
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  signOutLabel: {
    fontFamily: fonts.body.medium,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
});
