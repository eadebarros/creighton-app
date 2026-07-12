import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ObservationsSheet } from '../../components/ObservationsSheet';
import { StampBadge } from '../../components/StampBadge';
import { stateToToken } from '@creighton/rules-engine';
import { colors, fonts, radii, spacing } from '../../theme';
import { getDb } from '../../db/client';
import { getActiveCycle, getCycleVariantMode } from '../../db/cycleRepository';
import { getFertilityStatesForCycle, hasEntryForDate } from '../../db/entryRepository';
import { today } from '../../domain/dateMath';
import { groupByContiguousPhase, peakRelationLabel } from './chartGrouping';
import type { ChartDay, PhaseGroup } from './chartGrouping';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Chart'>;

const LEGEND_ITEMS: { color: 'RED' | 'GREEN' | 'WHITE' | 'YELLOW'; label: string }[] = [
  { color: 'RED', label: 'Sangramento' },
  { color: 'GREEN', label: 'Seco / infértil' },
  { color: 'WHITE', label: 'Muco fértil' },
  { color: 'YELLOW', label: 'Protocolo PIB' },
];

export function ChartScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [groups, setGroups] = useState<PhaseGroup[] | null>(null);
  const [dayNumberByDate, setDayNumberByDate] = useState<Map<string, number>>(new Map());
  const [inObservationPhase, setInObservationPhase] = useState(false);
  const [inMonitoringPhase, setInMonitoringPhase] = useState(false);
  const [cycleId, setCycleId] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [hasRegisteredToday, setHasRegisteredToday] = useState(false);

  async function loadChart() {
    const db = await getDb();
    const activeCycle = await getActiveCycle(db);
    if (!activeCycle) {
      setCycleId(null);
      setGroups([]);
      setHasRegisteredToday(false);
      return;
    }
    setCycleId(activeCycle.id);
    setHasRegisteredToday(await hasEntryForDate(db, activeCycle.id, today()));
    const variantMode = await getCycleVariantMode(db, activeCycle.id);
    const results = await getFertilityStatesForCycle(db, activeCycle.id);
    const days: ChartDay[] = results.map(({ row, state }) => ({
      date: row.date,
      rawCode: row.raw_code,
      bleedingType: row.bleeding_type,
      intercourse: row.intercourse === 1,
      computedState: state.computedState,
      peakRelation: state.peakRelation,
      pibActive: state.pibActive,
      lactationPhase: state.lactationPhase,
    }));
    setDayNumberByDate(new Map(days.map((day, i) => [day.date, i + 1])));
    setGroups(groupByContiguousPhase(days));
    setInObservationPhase(days[days.length - 1]?.lactationPhase === 'OBSERVATION');
    // Adendo 02 — Pré-menopausa: a pending candidate awaiting cross-cycle
    // confirmation, only ever resolved when the cycle actually closes.
    // Other variants also use the CANDIDATE label transiently, so this only
    // applies to MENOPAUSE.
    setInMonitoringPhase(variantMode === 'MENOPAUSE' && days[days.length - 1]?.peakRelation === 'CANDIDATE');
  }

  useEffect(() => {
    loadChart();
  }, []);

  const initial = (user?.primaryEmailAddress?.emailAddress ?? '').charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Gráfico do ciclo</Text>
            <Text style={styles.subtitle}>Arraste cada linha para o lado</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              style={styles.registerButton}
              onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Bleeding' }] })}
            >
              <Text style={styles.registerButtonText}>{hasRegisteredToday ? 'Novo registro' : 'Registrar hoje'}</Text>
            </Pressable>
            <Pressable style={styles.profileButton} onPress={() => navigation.navigate('Settings')}>
              <Text style={styles.profileInitial}>{initial}</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {groups === null && <Text style={styles.subtitle}>Carregando…</Text>}
        {groups?.length === 0 && (
          <Text style={styles.subtitle}>Nenhum ciclo registrado ainda.</Text>
        )}
        {inObservationPhase && (
          <Text style={styles.observationBanner}>Fase de observação: abstinência recomendada.</Text>
        )}
        {inMonitoringPhase && (
          <View style={styles.monitoringBanner}>
            <Text style={styles.monitoringBannerTitle}>Ciclo longo sob monitoramento</Text>
            <Text style={styles.monitoringBannerBody}>
              Aguardando confirmação do Ápice. Comum neste modo — acompanhamento contínuo, sem prazo fixo.
            </Text>
          </View>
        )}
        {groups?.map((group) => (
          <View key={`${group.label}-${group.days[0]?.date}`} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRow}>
              {group.days.map((day) => (
                <Pressable key={day.date} style={styles.dayColumn} onPress={() => setSheetDate(day.date)}>
                  <StampBadge
                    color={stateToToken({
                      bleedingType: day.bleedingType,
                      computedState: day.computedState,
                      pibActive: day.pibActive,
                    })}
                    rawCode={day.rawCode}
                    intercourse={day.intercourse}
                    peakLabel={peakRelationLabel(day.peakRelation) ?? undefined}
                    daySeed={day.date}
                    size={60}
                  />
                  <Text style={styles.dayNumber}>{dayNumberByDate.get(day.date)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.legend, { paddingBottom: insets.bottom + spacing.md }]}>
        {LEGEND_ITEMS.map((item) => (
          <View key={item.color} style={styles.legendItem}>
            <StampBadge color={item.color} rawCode="—" size={34} />
            <Text style={styles.legendLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {sheetDate && cycleId && (
        <ObservationsSheet
          cycleId={cycleId}
          date={sheetDate}
          onClose={() => setSheetDate(null)}
          onChanged={loadChart}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  registerButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
  },
  registerButtonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.white,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontFamily: fonts.display.medium,
    fontSize: 14,
    color: colors.white,
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
    marginTop: spacing.xs,
  },
  body: {
    paddingBottom: spacing.xl,
  },
  observationBanner: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.ink,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
  },
  monitoringBanner: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  monitoringBannerTitle: {
    fontFamily: fonts.display.medium,
    fontSize: 15,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  monitoringBannerBody: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  group: {
    marginTop: spacing.lg,
  },
  groupLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.inkMuted,
    letterSpacing: 0.6,
    marginLeft: spacing.xl,
    marginBottom: spacing.xs,
  },
  groupRow: {
    paddingHorizontal: spacing.xl,
    paddingTop: 14,
    gap: spacing.lg,
    alignItems: 'flex-end',
  },
  dayColumn: {
    alignItems: 'center',
  },
  dayNumber: {
    fontFamily: fonts.display.medium,
    fontSize: 14,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  legend: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  legendItem: {
    alignItems: 'center',
    width: 64,
  },
  legendLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 10,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
