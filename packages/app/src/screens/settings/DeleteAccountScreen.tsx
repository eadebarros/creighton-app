import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth, useSession } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { deleteMyAccount } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;

const DELETE_WORD = 'EXCLUIR';

type Step =
  | { kind: 'consequences' }
  | { kind: 'password'; error: string | null; verifying: boolean }
  | { kind: 'confirm'; deleting: boolean; error: string | null }
  | { kind: 'done' };

export function DeleteAccountScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken, signOut } = useAuth();
  const { session } = useSession();
  const [step, setStep] = useState<Step>({ kind: 'consequences' });
  const [password, setPassword] = useState('');
  const [typedWord, setTypedWord] = useState('');

  async function handleVerifyPassword() {
    if (!session) return;
    setStep({ kind: 'password', error: null, verifying: true });
    try {
      // Reauth via Clerk's own session verification — there is no password in
      // our backend to check (Clerk owns identity here). first_factor covers
      // password strategy, which is the only sign-in method this app offers.
      await session.startVerification({ level: 'first_factor' });
      const result = await session.attemptFirstFactorVerification({ strategy: 'password', password });
      if (result.status === 'complete') {
        setStep({ kind: 'confirm', deleting: false, error: null });
      } else {
        setStep({ kind: 'password', error: 'Senha incorreta. Tente de novo.', verifying: false });
      }
    } catch {
      setStep({ kind: 'password', error: 'Senha incorreta. Tente de novo.', verifying: false });
    }
  }

  async function handleDelete() {
    setStep({ kind: 'confirm', deleting: true, error: null });
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      await deleteMyAccount(getApiBaseUrl(), token);
      setStep({ kind: 'done' });
      // Let "Sua conta foi excluída" actually be seen before signOut() swaps
      // the whole tree back to AuthScreen (mirrors SignUpForm's justVerified pause).
      setTimeout(() => signOut(), 1200);
    } catch {
      setStep({ kind: 'confirm', deleting: false, error: 'Não foi possível excluir agora. Verifique a conexão e tente de novo.' });
    }
  }

  const deleteEnabled = typedWord.trim().toUpperCase() === DELETE_WORD;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}>
      {step.kind === 'consequences' && (
        <>
          <Text style={styles.title}>Excluir minha conta</Text>
          <Text style={styles.body}>
            Tudo é excluído definitivamente do servidor.{'\n'}
            Seu parceiro é desvinculado na hora.{'\n'}
            Não há recuperação após a exclusão.
          </Text>
          <Pressable style={styles.infoCard} onPress={() => navigation.navigate('DownloadData')}>
            <Text style={styles.infoCardTitle}>Baixar meus dados antes</Text>
            <Text style={styles.infoCardBody}>Recomendado — leva menos de um minuto.</Text>
          </Pressable>
          <View style={styles.spacer} />
          <View style={styles.actions}>
            <Pressable style={styles.dangerButton} onPress={() => setStep({ kind: 'password', error: null, verifying: false })}>
              <Text style={styles.dangerButtonText}>Continuar</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => navigation.goBack()}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </Pressable>
          </View>
        </>
      )}

      {step.kind === 'password' && (
        <>
          <Text style={styles.title}>Confirme sua senha</Text>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          {step.error && <Text style={styles.error}>{step.error}</Text>}
          <View style={styles.spacer} />
          <Pressable style={styles.dangerButton} onPress={handleVerifyPassword} disabled={step.verifying}>
            <Text style={styles.dangerButtonText}>{step.verifying ? 'Verificando…' : 'Continuar'}</Text>
          </Pressable>
        </>
      )}

      {step.kind === 'confirm' && (
        <>
          <Text style={styles.title}>Confirmação final</Text>
          <Text style={styles.body}>Digite {DELETE_WORD} abaixo para confirmar. Esta ação não pode ser desfeita.</Text>
          <TextInput
            value={typedWord}
            onChangeText={setTypedWord}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder={DELETE_WORD}
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />
          {step.error && <Text style={styles.error}>{step.error}</Text>}
          <View style={styles.spacer} />
          <Pressable
            style={[styles.dangerButton, !deleteEnabled && styles.dangerButtonDisabled]}
            onPress={handleDelete}
            disabled={!deleteEnabled || step.deleting}
          >
            <Text style={[styles.dangerButtonText, !deleteEnabled && styles.dangerButtonTextDisabled]}>
              {step.deleting ? 'Excluindo…' : 'Excluir minha conta'}
            </Text>
          </Pressable>
        </>
      )}

      {step.kind === 'done' && (
        <View style={styles.center}>
          <Text style={styles.doneTitle}>Sua conta foi excluída</Text>
          <Text style={styles.body}>Todos os seus dados foram removidos do servidor.</Text>
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
  spacer: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 22,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.body.medium,
    fontSize: 12,
    color: colors.inkMuted,
    marginBottom: spacing.xs,
  },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body.regular,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  error: {
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.white,
    marginBottom: spacing.xl,
  },
  infoCardTitle: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.ink,
    marginBottom: 2,
  },
  infoCardBody: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
  },
  actions: {
    gap: spacing.md,
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
  secondaryButton: {
    minHeight: 48,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.ink,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  doneTitle: {
    fontFamily: fonts.display.medium,
    fontSize: 19,
    color: colors.ink,
  },
});
