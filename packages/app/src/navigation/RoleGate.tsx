import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@clerk/expo';
import { getMe } from '../api/client';
import { getApiBaseUrl } from '../api/config';
import { getDb } from '../db/client';
import { getCycleCount } from '../db/cycleRepository';
import { resetLocalData } from '../db/schema';
import { RoleChoiceScreen } from '../screens/onboarding/RoleChoiceScreen';
import { PartnerDashboardScreen } from '../screens/partner/PartnerDashboardScreen';
import { colors, fonts, spacing } from '../theme';
import { shouldShowRoleChoice } from './roleChoiceGate';
import { RootNavigator } from './RootNavigator';

const ROLE_CACHE_KEY = 'creighton.role';
const LAST_USER_CACHE_KEY = 'creighton.lastClerkUserId';

/**
 * The local SQLite DB has no per-user scoping of its own — it's one shared
 * file on the device. If a different Clerk identity signs in than the one
 * who last used this device (a genuinely different person, not just a
 * fresh install), the previous person's health data must not leak into the
 * new session. Only wipes on a real mismatch — a first-ever launch (no
 * prior id recorded) never wipes, so upgrading an existing Sprint 1/2
 * install never loses real data.
 */
async function ensureLocalDataMatchesSignedInUser(userId: string): Promise<void> {
  const lastUserId = await SecureStore.getItemAsync(LAST_USER_CACHE_KEY);
  if (lastUserId && lastUserId !== userId) {
    const db = await getDb();
    await resetLocalData(db);
    await SecureStore.deleteItemAsync(ROLE_CACHE_KEY);
  }
  await SecureStore.setItemAsync(LAST_USER_CACHE_KEY, userId);
}

type Stage =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'roleChoice' }
  | { kind: 'primary' }
  | { kind: 'partner' };

/**
 * Role-based routing entry point, rendered once signed in (App.tsx's
 * AuthGate). Reads a cached role from SecureStore (already a dependency, used
 * for Clerk's own token cache) to render immediately without a network wait
 * on every launch; always refreshes via GET /me in the background so the
 * cache stays correct for next time. Only a genuinely fresh install (no
 * cache yet) blocks on that first call — there's no offline path into a
 * brand-new account anyway, since reaching this point already required
 * Clerk sign-in.
 */
export function RoleGate() {
  const { getToken, userId } = useAuth();
  const [stage, setStage] = useState<Stage>({ kind: 'loading' });

  async function resolve() {
    if (userId) {
      await ensureLocalDataMatchesSignedInUser(userId);
    }

    const cached = await SecureStore.getItemAsync(ROLE_CACHE_KEY);
    if (cached === 'COOP_PARTNER') {
      setStage({ kind: 'partner' });
    } else if (cached === 'PRIMARY_OBSERVER') {
      setStage({ kind: 'primary' });
    }

    try {
      const token = await getToken();
      if (!token) {
        if (!cached) setStage({ kind: 'error' });
        return;
      }
      const me = await getMe(getApiBaseUrl(), token);
      await SecureStore.setItemAsync(ROLE_CACHE_KEY, me.role);

      if (me.role === 'COOP_PARTNER') {
        setStage({ kind: 'partner' });
        return;
      }

      const db = await getDb();
      const cycleCount = await getCycleCount(db);
      setStage(shouldShowRoleChoice(me, cycleCount) ? { kind: 'roleChoice' } : { kind: 'primary' });
    } catch {
      if (!cached) {
        setStage({ kind: 'error' });
      }
      // else: keep showing the cached tree — this was just a background refresh attempt.
    }
  }

  useEffect(() => {
    resolve();
  }, [getToken, userId]);

  switch (stage.kind) {
    case 'loading':
      return (
        <View style={styles.center}>
          <Text style={styles.text}>Carregando…</Text>
        </View>
      );
    case 'error':
      return (
        <View style={styles.center}>
          <Text style={styles.text}>Sem conexão. Verifique a internet e tente de novo.</Text>
          <Text style={styles.retry} onPress={resolve}>
            Tentar novamente
          </Text>
        </View>
      );
    case 'roleChoice':
      return (
        <RoleChoiceScreen
          onChoosePrimary={() => setStage({ kind: 'primary' })}
          onLinkedAsPartner={() => setStage({ kind: 'partner' })}
        />
      );
    case 'partner':
      return <PartnerDashboardScreen />;
    case 'primary':
      return <RootNavigator />;
  }
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    padding: spacing.xl,
    gap: spacing.md,
  },
  text: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
  retry: {
    fontFamily: fonts.body.medium,
    fontSize: 14,
    color: colors.accent,
  },
});
