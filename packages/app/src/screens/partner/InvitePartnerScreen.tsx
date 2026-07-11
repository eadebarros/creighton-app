import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/expo';
import { createPartnerInvite, getMe } from '../../api/client';
import type { MeResponse } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'InvitePartner'>;

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'linked'; email: string } | { kind: 'code'; code: string };

export function InvitePartnerScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('no token');
        const me: MeResponse = await getMe(getApiBaseUrl(), token);
        if (cancelled) return;
        if (me.partner) {
          setState({ kind: 'linked', email: me.partner.email });
          return;
        }
        const invite = await createPartnerInvite(getApiBaseUrl(), token);
        if (!cancelled) setState({ kind: 'code', code: invite.code });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

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

        {state.kind === 'code' && (
          <>
            <Text style={styles.subtitle}>
              Compartilhe este código com seu parceiro. Ele expira em 24 horas.
            </Text>
            <Text style={styles.code}>{state.code}</Text>
            <Pressable
              style={styles.button}
              onPress={() => Share.share({ message: `Meu código do Creighton Tracker: ${state.code}` })}
            >
              <Text style={styles.buttonText}>Compartilhar</Text>
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
  code: {
    fontFamily: fonts.mono.semiBold,
    fontSize: 32,
    letterSpacing: 4,
    color: colors.ink,
    marginTop: spacing.md,
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
