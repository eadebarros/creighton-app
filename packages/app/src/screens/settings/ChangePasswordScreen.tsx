import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@clerk/expo';
import { isClerkAPIResponseError } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PasswordStrengthMeter } from '../../components/PasswordStrengthMeter';
import { TextField } from '../../components/TextField';
import { colors, fonts, radii, spacing } from '../../theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export function ChangePasswordScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      await user.updatePassword({ currentPassword, newPassword, signOutOfOtherSessions: true });
      setSuccess(true);
      setTimeout(() => navigation.goBack(), 900);
    } catch (err) {
      if (isClerkAPIResponseError(err)) {
        setError(err.errors[0]?.longMessage ?? err.errors[0]?.message ?? 'Senha atual incorreta.');
      } else {
        setError('Não foi possível alterar a senha agora.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <View style={[styles.screen, styles.centeredScreen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.successTitle}>Senha alterada</Text>
        <Text style={styles.successBody}>Voltando para Configurações.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>
      <Text style={styles.title}>Alterar senha</Text>

      <View style={styles.form}>
        <TextField
          label="Senha atual"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoComplete="password"
        />
        <View>
          <TextField label="Nova senha" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="password-new" />
          {newPassword.length > 0 && <PasswordStrengthMeter password={newPassword} />}
        </View>
        <TextField
          label="Confirmar nova senha"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="password-new"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? 'Alterando…' : 'Alterar senha'}</Text>
        </Pressable>
      </View>
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
  back: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 24,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
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
