import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StampBadge } from '../../components/StampBadge';
import { stateToToken } from '@creighton/rules-engine';
import { colors, fonts, radii, spacing } from '../../theme';
import { getDb } from '../../db/client';
import { getActiveCycle } from '../../db/cycleRepository';
import { getFertilityStatesForCycle } from '../../db/entryRepository';
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
  const { signOut } = useAuth();
  const [groups, setGroups] = useState<PhaseGroup[] | null>(null);
  const [dayNumberByDate, setDayNumberByDate] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const db = await getDb();
      const activeCycle = await getActiveCycle(db);
      if (!activeCycle) {
        if (!cancelled) setGroups([]);
        return;
      }
      const results = await getFertilityStatesForCycle(db, activeCycle.id);
      const days: ChartDay[] = results.map(({ row, state }) => ({
        date: row.date,
        rawCode: row.raw_code,
        bleedingType: row.bleeding_type,
        intercourse: row.intercourse === 1,
        computedState: state.computedState,
        peakRelation: state.peakRelation,
      }));
      if (!cancelled) {
        setDayNumberByDate(new Map(days.map((day, i) => [day.date, i + 1])));
        setGroups(groupByContiguousPhase(days));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
              <Text style={styles.registerButtonText}>Registrar hoje</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('InvitePartner')}>
              <Text style={styles.signOutLabel}>Convidar parceiro</Text>
            </Pressable>
            <Pressable onPress={() => signOut()}>
              <Text style={styles.signOutLabel}>Sair</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {groups === null && <Text style={styles.subtitle}>Carregando…</Text>}
        {groups?.length === 0 && (
          <Text style={styles.subtitle}>Nenhum ciclo registrado ainda.</Text>
        )}
        {groups?.map((group) => (
          <View key={`${group.label}-${group.days[0]?.date}`} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupRow}>
              {group.days.map((day) => (
                <View key={day.date} style={styles.dayColumn}>
                  <StampBadge
                    color={stateToToken({ bleedingType: day.bleedingType, computedState: day.computedState })}
                    rawCode={day.rawCode}
                    intercourse={day.intercourse}
                    peakLabel={peakRelationLabel(day.peakRelation) ?? undefined}
                    daySeed={day.date}
                    size={60}
                  />
                  <Text style={styles.dayNumber}>{dayNumberByDate.get(day.date)}</Text>
                </View>
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
    alignItems: 'flex-end',
    gap: spacing.sm,
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
  signOutLabel: {
    fontFamily: fonts.body.medium,
    fontSize: 12,
    color: colors.inkMuted,
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
