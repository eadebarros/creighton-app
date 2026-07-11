import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { createPartnerInvite, getMe } from '../../api/client';
import type { MeResponse, PartnerInvite } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'InvitePartner'>;

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'linked'; email: string }
  | { kind: 'code'; invite: PartnerInvite };

/** Visual grouping only — the stored/submitted code stays a plain 8 chars (see RedeemInviteForm). */
function formatCodeForDisplay(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export function InvitePartnerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [now, setNow] = useState(() => Date.now());

  async function loadInvite() {
    setState({ kind: 'loading' });
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const me: MeResponse = await getMe(getApiBaseUrl(), token);
      if (me.partner) {
        setState({ kind: 'linked', email: me.partner.email });
        return;
      }
      const invite = await createPartnerInvite(getApiBaseUrl(), token);
      setState({ kind: 'code', invite });
    } catch {
      setState({ kind: 'error' });
    }
  }

  useEffect(() => {
    loadInvite();
    // Local expiry re-check — no server round trip needed just to notice time has passed.
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [getToken]);

  const isExpired = state.kind === 'code' && now > Date.parse(state.invite.expiresAt);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>Convidar parceiro</Text>

        {state.kind === 'loading' && <Text style={styles.subtitle}>Carregando…</Text>}
        {state.kind === 'error' && <Text style={styles.subtitle}>Não foi possível gerar o código agora.</Text>}
        {state.kind === 'linked' && <Text style={styles.subtitle}>Vinculado a {state.email}.</Text>}

        {state.kind === 'code' && !isExpired && (
          <>
            <Text style={styles.subtitle}>
              Compartilhe este código com seu parceiro. Ele expira em 24 horas.
            </Text>
            <View style={styles.codeCard}>
              <Text style={styles.code}>{formatCodeForDisplay(state.invite.code)}</Text>
              <Text style={styles.codeNote}>Válido por 24h</Text>
            </View>
            <Pressable
              style={styles.button}
              onPress={() =>
                Share.share({ message: `Meu código do Creighton Tracker: ${formatCodeForDisplay(state.invite.code)}` })
              }
            >
              <Text style={styles.buttonText}>Compartilhar convite</Text>
            </Pressable>
          </>
        )}

        {state.kind === 'code' && isExpired && (
          <>
            <View style={[styles.codeCard, styles.codeCardExpired]}>
              <Text style={[styles.code, styles.codeExpired]}>{formatCodeForDisplay(state.invite.code)}</Text>
              <Text style={styles.codeNote}>Convite expirado</Text>
            </View>
            <Pressable style={styles.button} onPress={loadInvite}>
              <Text style={styles.buttonText}>Gerar novo convite</Text>
            </Pressable>
          </>
        )}
      </View>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  codeCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.xl,
    backgroundColor: colors.white,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  codeCardExpired: {
    backgroundColor: colors.paper,
    opacity: 0.6,
  },
  code: {
    fontFamily: fonts.mono.semiBold,
    fontSize: 24,
    letterSpacing: 2,
    color: colors.ink,
  },
  codeExpired: {
    textDecorationLine: 'line-through',
  },
  codeNote: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
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
