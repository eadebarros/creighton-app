import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RULES_ENGINE_VERSION } from '@creighton/rules-engine';
import { getMe } from '../../api/client';
import type { MeResponse } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { getDb } from '../../db/client';
import { getPendingOutboxEntries } from '../../db/outboxRepository';
import { resetAllLocalState } from '../../settings/localDataReset';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const VARIANT_LABELS: Record<string, string> = {
  REGULAR: 'Regular',
  LACTATION: 'Lactação',
  MENOPAUSE: 'Pré-menopausa',
};

/** Matches packages/app/app.json's expo.version — a plain constant here, same pattern as RULES_ENGINE_VERSION. */
const APP_VERSION = '1.0.0';

interface RowItem {
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingsRow({ item }: { item: RowItem }) {
  const disabled = !item.onPress;
  return (
    <Pressable onPress={item.onPress} disabled={disabled} style={styles.row}>
      <Text style={[styles.rowLabel, item.danger && styles.rowLabelDanger, disabled && styles.rowLabelDisabled]}>
        {item.label}
      </Text>
      {item.value && <Text style={styles.rowValue}>{item.value}</Text>}
    </Pressable>
  );
}

export function SettingsHubScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        setMe(await getMe(getApiBaseUrl(), token));
      } catch {
        // Best-effort — the hub still renders (just without "modo atual"/parceiro).
      }
    })();
  }, [getToken]);

  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const initial = email.charAt(0).toUpperCase() || '?';

  function confirmResetTestAccount() {
    Alert.alert(
      'Resetar conta de teste',
      'Isso apaga todo o histórico (neste dispositivo e no servidor), reabre a onboarding e desconecta você. Use só para teste. Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resetar e sair',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) throw new Error('no token');
              await resetAllLocalState(getApiBaseUrl(), token);
              await signOut();
            } catch {
              Alert.alert('Falha ao resetar', 'Verifique a conexão e tente de novo.');
            }
          },
        },
      ],
    );
  }

  async function handleResetTestAccount() {
    const db = await getDb();
    const pending = await getPendingOutboxEntries(db);
    if (pending.length === 0) {
      confirmResetTestAccount();
      return;
    }
    Alert.alert(
      'Há registros não sincronizados',
      `${pending.length} registro(s) deste dispositivo ainda não foram enviados ao servidor. Resetar agora descarta esses registros.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Resetar mesmo assim', style: 'destructive', onPress: confirmResetTestAccount },
      ],
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.email}>{email}</Text>
        </View>
        {me && (
          <Text style={styles.variantLine}>
            Modo atual: {VARIANT_LABELS[me.currentVariantMode] ?? me.currentVariantMode}
          </Text>
        )}

        <Text style={styles.sectionLabel}>Método</Text>
        <SettingsRow item={{ label: 'Modo de acompanhamento', value: 'Em breve' }} />
        <SettingsRow item={{ label: 'Exportar para instrutora', onPress: () => navigation.navigate('ExportPdf') }} />

        <Text style={styles.sectionLabel}>Casal</Text>
        <SettingsRow
          item={{
            label: 'Parceiro',
            value: me?.partner ? me.partner.email : undefined,
            onPress: () => navigation.navigate('PartnerSettings'),
          }}
        />
        <SettingsRow item={{ label: 'Privacidade do parceiro', value: 'Em breve' }} />

        <Text style={styles.sectionLabel}>Conta</Text>
        <SettingsRow item={{ label: 'Alterar senha', onPress: () => navigation.navigate('ChangePassword') }} />
        <SettingsRow item={{ label: 'Notificações', onPress: () => navigation.navigate('Notifications') }} />

        <Text style={styles.sectionLabel}>Dados &amp; privacidade</Text>
        <SettingsRow item={{ label: 'Baixar meus dados', value: 'Em breve' }} />
        <SettingsRow item={{ label: 'Termos e disclaimer clínico', onPress: () => navigation.navigate('Terms') }} />

        <View style={styles.dangerZone}>
          <SettingsRow item={{ label: 'Excluir minha conta', value: 'Em breve', danger: true }} />
        </View>

        <Pressable onPress={() => signOut()} style={styles.row}>
          <Text style={styles.rowLabel}>Sair</Text>
        </Pressable>

        {__DEV__ && (
          <View style={styles.devSection}>
            <Text style={styles.sectionLabel}>Dev</Text>
            <Pressable onPress={handleResetTestAccount} style={styles.row}>
              <Text style={styles.rowLabel}>Resetar conta de teste</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.footer}>
          versão {APP_VERSION} · motor de regras v{RULES_ENGINE_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  backRow: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  back: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
  body: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: fonts.display.medium,
    fontSize: 18,
    color: colors.white,
  },
  email: {
    fontFamily: fonts.display.medium,
    fontSize: 16,
    color: colors.ink,
  },
  variantLine: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontFamily: fonts.body.semiBold,
    fontSize: 11,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.inkMuted,
    marginTop: spacing.lg,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    minHeight: 48,
  },
  rowLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 15,
    color: colors.ink,
  },
  rowLabelDisabled: {
    color: colors.inkMuted,
  },
  rowLabelDanger: {
    fontFamily: fonts.body.semiBold,
    color: colors.danger,
  },
  rowValue: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
  },
  dangerZone: {
    marginTop: spacing.xl,
  },
  devSection: {
    marginTop: spacing.lg,
    backgroundColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  footer: {
    fontFamily: fonts.mono.medium,
    fontSize: 11,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },
});
