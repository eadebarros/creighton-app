import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSignIn, useSignUp } from '@clerk/expo';
import { TextField } from '../../components/TextField';
import { colors, fonts, radii, spacing } from '../../theme';

type Mode = 'sign-in' | 'sign-up';

/**
 * Gates the whole app (see App.tsx's <SignedOut>) — Clerk owns identity here,
 * our own Postgres never stores a password (see packages/backend/prisma/schema.prisma).
 * Kept as one screen with local mode/step state rather than separate
 * navigator routes: there's no capture-flow-style multi-step progression to
 * track, just "which form is visible right now".
 */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');
  return mode === 'sign-in' ? (
    <SignInForm onSwitchToSignUp={() => setMode('sign-up')} />
  ) : (
    <SignUpForm onSwitchToSignIn={() => setMode('sign-in')} />
  );
}

function SignInForm({ onSwitchToSignUp }: { onSwitchToSignUp: () => void }) {
  const insets = useSafeAreaInsets();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSignIn() {
    setFormError(null);
    const { error } = await signIn.password({ emailAddress, password });
    if (error) {
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => {} });
    } else {
      setFormError('Não foi possível entrar. Verifique seus dados.');
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Text style={styles.title}>Entrar</Text>
      <Text style={styles.subtitle}>Acesse seu acompanhamento de ciclo.</Text>

      <View style={styles.form}>
        <TextField
          label="E-mail"
          value={emailAddress}
          onChangeText={setEmailAddress}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.fields.identifier?.message}
        />
        <TextField
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          error={errors.fields.password?.message}
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Pressable style={styles.button} onPress={handleSignIn} disabled={fetchStatus === 'fetching'}>
          <Text style={styles.buttonText}>{fetchStatus === 'fetching' ? 'Entrando…' : 'Entrar'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onSwitchToSignUp}>
        <Text style={styles.link}>Não tem conta? Criar uma</Text>
      </Pressable>
    </ScrollView>
  );
}

function SignUpForm({ onSwitchToSignIn }: { onSwitchToSignIn: () => void }) {
  const insets = useSafeAreaInsets();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSignUp() {
    setFormError(null);
    const { error } = await signUp.password({ emailAddress, password });
    if (error) {
      return;
    }
    await signUp.verifications.sendEmailCode();
  }

  async function handleVerify() {
    setFormError(null);
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === 'complete') {
      await signUp.finalize({ navigate: () => {} });
    } else {
      setFormError('Código inválido ou expirado.');
    }
  }

  const awaitingVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  if (awaitingVerification) {
    return (
      <ScrollView
        contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}
      >
        <Text style={styles.title}>Confirme seu e-mail</Text>
        <Text style={styles.subtitle}>Enviamos um código para {emailAddress}.</Text>

        <View style={styles.form}>
          <TextField
            label="Código"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            error={errors.fields.code?.message}
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <Pressable style={styles.button} onPress={handleVerify} disabled={fetchStatus === 'fetching'}>
            <Text style={styles.buttonText}>{fetchStatus === 'fetching' ? 'Verificando…' : 'Verificar'}</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => signUp.verifications.sendEmailCode()}>
          <Text style={styles.link}>Reenviar código</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Text style={styles.title}>Criar conta</Text>
      <Text style={styles.subtitle}>Comece a registrar seu ciclo.</Text>

      <View style={styles.form}>
        <TextField
          label="E-mail"
          value={emailAddress}
          onChangeText={setEmailAddress}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.fields.emailAddress?.message}
        />
        <TextField
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password-new"
          error={errors.fields.password?.message}
        />
        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Pressable style={styles.button} onPress={handleSignUp} disabled={fetchStatus === 'fetching'}>
          <Text style={styles.buttonText}>{fetchStatus === 'fetching' ? 'Criando…' : 'Continuar'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={onSwitchToSignIn}>
        <Text style={styles.link}>Já tem conta? Entrar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 26,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  form: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.white,
  },
  error: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.red,
  },
  link: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
