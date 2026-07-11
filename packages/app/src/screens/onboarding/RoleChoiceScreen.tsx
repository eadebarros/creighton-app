import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import * as SecureStore from 'expo-secure-store';
import { redeemPartnerInvite } from '../../api/client';
import { getApiBaseUrl } from '../../api/config';
import { TextField } from '../../components/TextField';
import { colors, fonts, radii, spacing } from '../../theme';

interface Props {
  onChoosePrimary: () => void;
  onLinkedAsPartner: () => void;
}

const ROLE_CACHE_KEY = 'creighton.role';

/** One-time fork shown only to a genuinely fresh account (see navigation/roleChoiceGate.ts). */
export function RoleChoiceScreen({ onChoosePrimary, onLinkedAsPartner }: Props) {
  const [redeeming, setRedeeming] = useState(false);
  return redeeming ? (
    <RedeemInviteForm onBack={() => setRedeeming(false)} onLinked={onLinkedAsPartner} />
  ) : (
    <ChoiceForm onChoosePrimary={onChoosePrimary} onChoosePartner={() => setRedeeming(true)} />
  );
}

function ChoiceForm({
  onChoosePrimary,
  onChoosePartner,
}: {
  onChoosePrimary: () => void;
  onChoosePartner: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl }]}>
      <Text style={styles.title}>Bem-vinda</Text>
      <Text style={styles.subtitle}>Como você vai usar o app?</Text>
      <Pressable style={styles.button} onPress={onChoosePrimary}>
        <Text style={styles.buttonText}>Começar a registrar meu ciclo</Text>
      </Pressable>
      <Pressable onPress={onChoosePartner}>
        <Text style={styles.link}>Tenho um código do meu parceiro</Text>
      </Pressable>
    </ScrollView>
  );
}

function RedeemInviteForm({ onBack, onLinked }: { onBack: () => void; onLinked: () => void }) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linkedEmail, setLinkedEmail] = useState<string | null>(null);

  async function handleRedeem() {
    setError(null);
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Sessão expirada — tente novamente.');
      }
      const cleanCode = code.trim().toUpperCase().replace(/-/g, '');
      const result = await redeemPartnerInvite(getApiBaseUrl(), token, cleanCode);
      await SecureStore.setItemAsync(ROLE_CACHE_KEY, 'COOP_PARTNER');
      setLinkedEmail(result.partnerEmail);
      setTimeout(onLinked, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível validar o código.');
    } finally {
      setSubmitting(false);
    }
  }

  if (linkedEmail) {
    return (
      <View style={[styles.screen, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.title}>Vinculado</Text>
        <Text style={styles.subtitle}>Você está conectado a {linkedEmail}.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.screen, { paddingTop: insets.top + spacing.xxxl }]}>
      <Text style={styles.title}>Inserir código</Text>
      <Text style={styles.subtitle}>Digite o código que seu parceiro compartilhou com você.</Text>
      <TextField
        label="Código"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        error={error ?? undefined}
      />
      <Pressable style={styles.button} onPress={handleRedeem} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Verificando…' : 'Confirmar'}</Text>
      </Pressable>
      <Pressable onPress={onBack}>
        <Text style={styles.link}>Voltar</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexGrow: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing.md,
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
  link: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
