import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useSignIn, useSignUp } from '@clerk/expo';
import { TextField } from '../../components/TextField';
import { colors, fonts, radii, spacing } from '../../theme';

type Mode = 'sign-in' | 'sign-up' | 'forgot-password';

/**
 * Gates the whole app (see App.tsx's <SignedOut>) — Clerk owns identity here,
 * our own Postgres never stores a password (see packages/backend/prisma/schema.prisma).
 * Kept as one screen with local mode/step state rather than separate
 * navigator routes: there's no capture-flow-style multi-step progression to
 * track, just "which form is visible right now".
 */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('sign-in');
  if (mode === 'sign-up') {
    return <SignUpForm onSwitchToSignIn={() => setMode('sign-in')} />;
  }
  if (mode === 'forgot-password') {
    return <ForgotPasswordForm onBack={() => setMode('sign-in')} />;
  }
  return (
    <SignInForm onSwitchToSignUp={() => setMode('sign-up')} onForgotPassword={() => setMode('forgot-password')} />
  );
}

function estimatePasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Za-z]/.test(password) && /[0-9]/.test(password)) score++;
  if (password.length >= 12) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, Math.min(4, score));
}

const STRENGTH_LABELS = ['Fraca', 'Razoável', 'Boa', 'Forte'];

function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = estimatePasswordStrength(password);
  return (
    <View>
      <View style={styles.strengthBars}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[styles.strengthBar, i < strength && styles.strengthBarFilled]} />
        ))}
      </View>
      <Text style={styles.strengthLabel}>{STRENGTH_LABELS[strength - 1]}</Text>
    </View>
  );
}

function CheckmarkIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 52 52">
      <Path
        d="M15 27 L22 34 L37 18"
        stroke={colors.accent}
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SignInForm({
  onSwitchToSignUp,
  onForgotPassword,
}: {
  onSwitchToSignUp: () => void;
  onForgotPassword: () => void;
}) {
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
        <View style={styles.linkRow}>
          <Pressable onPress={onForgotPassword}>
            <Text style={styles.linkSmall}>Esqueci minha senha</Text>
          </Pressable>
          <Pressable onPress={onSwitchToSignUp}>
            <Text style={styles.linkSmall}>Criar conta</Text>
          </Pressable>
        </View>
      </View>
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
  const [justVerified, setJustVerified] = useState(false);

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
      setJustVerified(true);
      setTimeout(() => {
        signUp.finalize({ navigate: () => {} });
      }, 900);
    } else {
      setFormError('Código inválido ou expirado.');
    }
  }

  const awaitingVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  if (justVerified) {
    return (
      <View style={[styles.screen, styles.centeredScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <CheckmarkIcon />
        <Text style={styles.successTitle}>Conta criada</Text>
        <Text style={styles.successBody}>Avançando para a seleção do modo de acompanhamento.</Text>
      </View>
    );
  }

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
      <Text style={styles.subtitle}>Seus dados clínicos ficam vinculados a esta conta.</Text>

      <View style={styles.form}>
        <TextField
          label="E-mail"
          value={emailAddress}
          onChangeText={setEmailAddress}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.fields.emailAddress?.message}
        />
        <View>
          <TextField
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            error={errors.fields.password?.message}
          />
          {password.length > 0 && <PasswordStrengthMeter password={password} />}
        </View>
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

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleRequestCode() {
    setFormError(null);
    const created = await signIn.create({ identifier: emailAddress });
    if (created.error) {
      setFormError('Não foi possível encontrar essa conta.');
      return;
    }
    const sent = await signIn.resetPasswordEmailCode.sendCode();
    if (sent.error) {
      setFormError('Não foi possível enviar o código.');
      return;
    }
    setStep('reset');
  }

  async function handleReset() {
    setFormError(null);
    const verified = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (verified.error) {
      setFormError('Código inválido ou expirado.');
      return;
    }
    const submitted = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
    if (submitted.error) {
      setFormError('Não foi possível redefinir a senha.');
      return;
    }
    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => {} });
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Text style={styles.title}>Redefinir senha</Text>

      {step === 'request' ? (
        <View style={styles.form}>
          <TextField
            label="E-mail"
            value={emailAddress}
            onChangeText={setEmailAddress}
            keyboardType="email-address"
            autoComplete="email"
            error={errors.fields.identifier?.message}
          />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <Pressable style={styles.button} onPress={handleRequestCode} disabled={fetchStatus === 'fetching'}>
            <Text style={styles.buttonText}>{fetchStatus === 'fetching' ? 'Enviando…' : 'Enviar código'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <TextField label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" />
          <TextField label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          {formError ? <Text style={styles.error}>{formError}</Text> : null}
          <Pressable style={styles.button} onPress={handleReset} disabled={fetchStatus === 'fetching'}>
            <Text style={styles.buttonText}>{fetchStatus === 'fetching' ? 'Salvando…' : 'Redefinir senha'}</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={onBack}>
        <Text style={styles.link}>Voltar para entrar</Text>
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
  centeredScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 24,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
    marginBottom: spacing.md,
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
    fontFamily: fonts.body.semiBold,
    fontSize: 12,
    color: colors.ink,
  },
  link: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  linkSmall: {
    fontFamily: fonts.body.semiBold,
    fontSize: 13,
    color: colors.accent,
  },
  strengthBars: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.line,
  },
  strengthBarFilled: {
    backgroundColor: colors.accent,
  },
  strengthLabel: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: spacing.xs,
  },
  successTitle: {
    fontFamily: fonts.display.medium,
    fontSize: 19,
    color: colors.ink,
  },
  successBody: {
    fontFamily: fonts.body.regular,
    fontSize: 13,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 220,
  },
});
