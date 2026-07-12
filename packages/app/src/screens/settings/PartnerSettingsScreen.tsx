import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createPartnerInvite, getMe, unlinkPartner } from '../../api/client';
import type { MeResponse, PartnerInvite } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'PartnerSettings'>;

type State =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'linked'; email: string; linkedAt: string | null }
  | { kind: 'confirmUnlink'; email: string }
  | { kind: 'code'; invite: PartnerInvite };

const UNLINK_WORD = 'DESVINCULAR';

/** Visual grouping only — the stored/submitted code stays a plain 8 chars. */
function formatCodeForDisplay(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function formatLinkedSince(iso: string | null): string {
  if (!iso) return '';
  return `Vinculado desde ${new Date(iso).toLocaleDateString('pt-BR')}`;
}

export function PartnerSettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [unlinkText, setUnlinkText] = useState('');
  const [unlinking, setUnlinking] = useState(false);

  async function load() {
    setState({ kind: 'loading' });
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const me: MeResponse = await getMe(getApiBaseUrl(), token);
      if (me.partner) {
        setState({ kind: 'linked', email: me.partner.email, linkedAt: me.partner.linkedAt });
        return;
      }
      const invite = await createPartnerInvite(getApiBaseUrl(), token);
      setState({ kind: 'code', invite });
    } catch {
      setState({ kind: 'error' });
    }
  }

  useEffect(() => {
    load();
  }, [getToken]);

  async function handleUnlink() {
    if (state.kind !== 'confirmUnlink') return;
    setUnlinking(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      await unlinkPartner(getApiBaseUrl(), token);
      navigation.goBack();
    } catch {
      Alert.alert('Não foi possível desvincular', 'Verifique a conexão e tente de novo.');
    } finally {
      setUnlinking(false);
    }
  }

  const unlinkEnabled = unlinkText.trim().toUpperCase() === UNLINK_WORD;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title}>Parceiro</Text>

        {state.kind === 'loading' && <Text style={styles.subtitle}>Carregando…</Text>}
        {state.kind === 'error' && <Text style={styles.subtitle}>Não foi possível carregar agora.</Text>}

        {state.kind === 'code' && (
          <>
            <Text style={styles.subtitle}>Compartilhe este código com seu parceiro. Ele expira em 24 horas.</Text>
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

        {state.kind === 'linked' && (
          <>
            <View style={styles.linkedCard}>
              <Text style={styles.linkedEmail}>{state.email}</Text>
              {state.linkedAt && <Text style={styles.codeNote}>{formatLinkedSince(state.linkedAt)}</Text>}
            </View>
            <View style={styles.spacer} />
            <Pressable style={styles.dangerButton} onPress={() => setState({ kind: 'confirmUnlink', email: state.email })}>
              <Text style={styles.dangerButtonText}>Desvincular parceiro</Text>
            </Pressable>
          </>
        )}

        {state.kind === 'confirmUnlink' && (
          <>
            <Text style={styles.subtitle}>
              Ele perde o acesso ao seu status imediatamente. Seus registros e histórico não são afetados.
            </Text>
            <Text style={styles.confirmLabel}>Digite {UNLINK_WORD} para confirmar</Text>
            <TextInput
              value={unlinkText}
              onChangeText={setUnlinkText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={UNLINK_WORD}
              placeholderTextColor={colors.inkMuted}
              style={styles.input}
            />
            <View style={styles.spacer} />
            <Pressable
              style={[styles.dangerButton, !unlinkEnabled && styles.dangerButtonDisabled]}
              onPress={handleUnlink}
              disabled={!unlinkEnabled || unlinking}
            >
              <Text style={[styles.dangerButtonText, !unlinkEnabled && styles.dangerButtonTextDisabled]}>
                {unlinking ? 'Desvinculando…' : 'Desvincular parceiro'}
              </Text>
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
    marginTop: spacing.xl,
  },
  spacer: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
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
  code: {
    fontFamily: fonts.mono.semiBold,
    fontSize: 24,
    letterSpacing: 2,
    color: colors.ink,
  },
  codeNote: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: spacing.sm,
  },
  linkedCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    marginTop: spacing.md,
  },
  linkedEmail: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.ink,
  },
  button: {
    minHeight: 48,
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
  confirmLabel: {
    fontFamily: fonts.body.medium,
    fontSize: 13,
    color: colors.inkMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.mono.medium,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  dangerButton: {
    minHeight: 48,
    backgroundColor: colors.danger,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonDisabled: {
    backgroundColor: colors.line,
  },
  dangerButtonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  dangerButtonTextDisabled: {
    color: colors.inkMuted,
  },
});
