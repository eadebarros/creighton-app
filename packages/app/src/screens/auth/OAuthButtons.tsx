import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSSO } from '@clerk/expo';
import { colors, fonts, radii, spacing } from '../../theme';

interface Props {
  onError: (message: string) => void;
}

/**
 * Google/Apple via Clerk's useSSO — a browser-redirect flow (expo-auth-session
 * + expo-web-browser), fully Expo-Go-compatible (no native module, unlike
 * expo-apple-authentication's separate native Apple flow, which this
 * deliberately avoids). Requires the Google/Apple connections to be
 * configured in the Clerk Dashboard (with your own OAuth credentials for a
 * production instance) before either button does anything useful.
 */
export function OAuthButtons({ onError }: Props) {
  const { startSSOFlow } = useSSO();
  const [loading, setLoading] = useState<'oauth_google' | 'oauth_apple' | null>(null);

  async function handlePress(strategy: 'oauth_google' | 'oauth_apple') {
    setLoading(strategy);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
      // else: the user cancelled the browser flow — nothing to do.
    } catch {
      onError('Não foi possível entrar. Tente de novo.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou continue com</Text>
        <View style={styles.dividerLine} />
      </View>
      <Pressable
        style={styles.button}
        onPress={() => handlePress('oauth_google')}
        disabled={loading !== null}
      >
        {loading === 'oauth_google' ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.buttonText}>Continuar com Google</Text>
        )}
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={() => handlePress('oauth_apple')}
        disabled={loading !== null}
      >
        {loading === 'oauth_apple' ? (
          <ActivityIndicator color={colors.ink} />
        ) : (
          <Text style={styles.buttonText}>Continuar com Apple</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line,
  },
  dividerText: {
    fontFamily: fonts.body.regular,
    fontSize: 12,
    color: colors.inkMuted,
  },
  button: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  buttonText: {
    fontFamily: fonts.body.semiBold,
    fontSize: 15,
    color: colors.ink,
  },
});
