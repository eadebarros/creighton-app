import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getMe } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { colors, fonts, spacing } from '../../theme';
import {
  DISCLAIMER_BODY,
  DISCLAIMER_DOES_BODY,
  DISCLAIMER_DOES_LABEL,
  DISCLAIMER_DOESNT_BODY,
  DISCLAIMER_DOESNT_LABEL,
  DISCLAIMER_TITLE,
} from '../onboarding/disclaimerText';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Terms'>;

function formatAckDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR');
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `Aceito em ${date} às ${time}`;
}

export function TermsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [ackAt, setAckAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const me = await getMe(getApiBaseUrl(), token);
        setAckAt(me.instructorCredentialAckAt);
      } catch {
        // Best-effort — the text itself is unconditional; only the ack timestamp is optional.
      }
    })();
  }, [getToken]);

  return (
    <ScrollView
      contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
    >
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.back}>← Voltar</Text>
      </Pressable>
      <Text style={styles.title}>Termos e disclaimer clínico</Text>
      {ackAt && <Text style={styles.ackLine}>{formatAckDate(ackAt)}</Text>}

      <Text style={styles.body}>
        {DISCLAIMER_TITLE}
        {'\n\n'}
        {DISCLAIMER_BODY}
        {'\n\n'}
        {DISCLAIMER_DOES_LABEL}: {DISCLAIMER_DOES_BODY}
        {'\n\n'}
        {DISCLAIMER_DOESNT_LABEL}: {DISCLAIMER_DOESNT_BODY}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
  },
  back: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.display.medium,
    fontSize: 21,
    color: colors.ink,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  ackLine: {
    fontFamily: fonts.mono.medium,
    fontSize: 11,
    color: colors.inkMuted,
    marginBottom: spacing.lg,
  },
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 15,
    color: colors.ink,
    lineHeight: 24,
  },
});
